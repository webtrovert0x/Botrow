// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Botrow
 * @author Botrow Core Engineering
 * @notice Decentralized, AI-assisted zero-trust escrow smart contract for BOT Chain.
 * @dev Combines OpenZeppelin ReentrancyGuard, Pausable emergency safeguards, duplicate listing protection,
 * 7-day automated timeout claim fallbacks, and array getter utilities for optimized frontend subgraph interaction.
 */
contract Botrow is ReentrancyGuard, Ownable, Pausable {
    /**
     * @notice Represents the possible lifecycle states of an escrow transaction.
     */
    enum EscrowStatus {
        AWAITING_DELIVERY,
        DELIVERED,
        DISPUTED,
        RESOLVED_SELLER,
        RESOLVED_BUYER,
        CANCELLED,
        EXPIRED_RELEASED
    }

    /**
     * @notice Data structure containing full parameters and timeline timestamps for an escrow transaction.
     * @param id Unique incremental numerical identifier for the order.
     * @param onchainListingId Unique immutable metadata string referencing IPFS specifications.
     * @param buyer Cryptographic address of the purchasing participant who locks tokens.
     * @param seller Cryptographic address of the merchant providing hardware or digital service.
     * @param amount Gross amount of native BOT tokens deposited in wei.
     * @param protocolFee Calculated fee in wei scheduled for disbursement to DAO treasury upon delivery.
     * @param createdAt Timestamp when escrow deposit transaction was finalized on-chain.
     * @param expiresAt Timestamp after which an unresponsive order becomes eligible for automated seller timeout claim.
     * @param resolvedAt Timestamp when order concluded via fulfillment, refund, cancellation, or arbitration.
     * @param status Current lifecycle stage of the transaction.
     */
    struct Escrow {
        uint256 id;
        string onchainListingId;
        address payable buyer;
        address payable seller;
        uint256 amount;
        uint256 protocolFee;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 resolvedAt;
        EscrowStatus status;
    }

    // --- State Variables ---
    
    /// @dev Internal incrementer tracking total cumulative escrows generated.
    uint256 private _escrowCounter;

    /// @notice Duration of inactivity after which a seller may claim funds if buyer is unresponsive (7 days).
    uint256 public constant ESCROW_TIMEOUT_DURATION = 7 days;

    /// @notice Current protocol transaction fee expressed in Basis Points (BPS). 100 BPS equals 1.00%.
    uint256 public feePercentageBasisPoints = 100;

    /// @notice DAO treasury wallet designated to receive protocol fees upon delivery fulfillment.
    address payable public feeRecipient;

    /// @notice Impartial dispute referee authorized to arbitrate contested escrow transactions.
    address public arbitrator;

    /// @dev Internal mapping storing complete order struct data against its numerical ID.
    mapping(uint256 => Escrow) private _escrows;
    
    /// @dev Internal mapping of buyer wallet address to an array of associated order IDs.
    mapping(address => uint256[]) private _buyerEscrowIds;
    
    /// @dev Internal mapping of seller wallet address to an array of associated order IDs.
    mapping(address => uint256[]) private _sellerEscrowIds;
    
    /// @notice Tracks active status of item listing IDs to prevent duplicate purchases of unique physical DePIN inventory.
    mapping(string => bool) public activeListingIds;

    // --- Custom Errors ---
    
    /// @notice Thrown when attempting to assign or execute to an uninitialized zero address.
    error ZeroAddress();
    
    /// @notice Thrown when deposit amount is lower than protocol dust limit (10,000 wei).
    error InvalidAmount();
    
    /// @notice Thrown when querying an ID that does not map to a created escrow order.
    error EscrowNotFound();
    
    /// @notice Thrown when transaction signer lacks the authorized role required for the requested action.
    error UnauthorizedCaller();
    
    /// @notice Thrown when executing a function that is incompatible with the current escrow lifecycle status.
    error InvalidEscrowState();
    
    /// @notice Thrown when admin attempts to set protocol fee higher than the strict structural cap (500 BPS / 5%).
    error FeeExceedsMaximum();
    
    /// @notice Thrown when native BOT token disbursement fails during low-level address call.
    error TransferFailed();
    
    /// @notice Thrown when transaction signer designates themselves as both buyer and seller in an order.
    error CannotBuyFromSelf();
    
    /// @notice Thrown when attempting to create an escrow on a listing ID that is already locked in an active transaction.
    error ListingAlreadyEscrowed();
    
    /// @notice Thrown when attempting to trigger timeout claim prior to elapsing of the full 7-day window.
    error EscrowNotYetExpired();

    // --- Events ---
    
    /**
     * @notice Emitted when a buyer deposits tokens and initializes an awaiting escrow lock.
     * @param escrowId Numerical ID assigned to the new transaction.
     * @param onchainListingId Metadata listing identification string.
     * @param buyer Signer address locking funds.
     * @param seller Merchant address designated to receive payment upon delivery.
     * @param amount Gross token deposit amount in wei.
     * @param protocolFee Calculated treasury fee component in wei.
     * @param expiresAt Unix timestamp when order becomes eligible for timeout settlement.
     */
    event EscrowCreated(
        uint256 indexed escrowId,
        string onchainListingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 protocolFee,
        uint256 expiresAt
    );

    /**
     * @notice Emitted when a buyer confirms delivery and releases funds to the seller.
     * @param escrowId Numerical ID of the fulfilled transaction.
     * @param buyer Address of the purchasing participant who signed off on fulfillment.
     * @param sellerPayout Net token amount transferred directly to the seller wallet.
     */
    event DeliveryConfirmed(uint256 indexed escrowId, address indexed buyer, uint256 sellerPayout);

    /**
     * @notice Emitted when either contracting party or the arbitrator opens a dispute on an active order.
     * @param escrowId Numerical ID of the contested order.
     * @param initiator Signer address triggering the dispute state.
     */
    event DisputeOpened(uint256 indexed escrowId, address indexed initiator);

    /**
     * @notice Emitted when an authorized arbitrator delivers a binding ruling on a disputed order.
     * @param escrowId Numerical ID of the resolved order.
     * @param sellerWon Boolean representing ruling outcome (true if released to seller, false if refunded to buyer).
     */
    event DisputeResolved(uint256 indexed escrowId, bool sellerWon);

    /**
     * @notice Emitted when a seller exercises a valid timeout claim on an unresponsive 7-day old escrow order.
     * @param escrowId Numerical ID of the expired order.
     * @param releasedTo Seller wallet address receiving the timeout settlement.
     * @param payout Net token amount disbursed in wei.
     */
    event EscrowExpired(uint256 indexed escrowId, address indexed releasedTo, uint256 payout);

    /**
     * @notice Emitted when a seller voluntarily cancels an awaiting order and fully refunds the buyer.
     * @param escrowId Numerical ID of the cancelled order.
     * @param cancelledBy Merchant address initiating the voluntary cancellation.
     * @param refundAmount Total token deposit amount returned to buyer wallet.
     */
    event EscrowCancelled(uint256 indexed escrowId, address indexed cancelledBy, uint256 refundAmount);

    /**
     * @notice Emitted when protocol admin modifies the fee percentage basis points.
     * @param oldFeeBps Previous protocol fee rate in BPS.
     * @param newFeeBps Updated protocol fee rate in BPS.
     */
    event ProtocolFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    /**
     * @notice Emitted when protocol admin updates the designated dispute arbitrator wallet.
     * @param oldArbitrator Previous arbitrator cryptographic address.
     * @param newArbitrator Newly appointed arbitrator cryptographic address.
     */
    event ArbitratorUpdated(address indexed oldArbitrator, address indexed newArbitrator);

    // --- Modifiers ---
    
    modifier onlyBuyer(uint256 _id) {
        if (_escrows[_id].buyer != msg.sender) revert UnauthorizedCaller();
        _;
    }

    modifier onlySeller(uint256 _id) {
        if (_escrows[_id].seller != msg.sender) revert UnauthorizedCaller();
        _;
    }

    modifier onlyPartyOrArbitrator(uint256 _id) {
        if (
            _escrows[_id].buyer != msg.sender &&
            _escrows[_id].seller != msg.sender &&
            msg.sender != arbitrator &&
            msg.sender != owner()
        ) revert UnauthorizedCaller();
        _;
    }

    modifier inStatus(uint256 _id, EscrowStatus _expectedStatus) {
        if (_escrows[_id].status != _expectedStatus) revert InvalidEscrowState();
        _;
    }

    /**
     * @notice Contract constructor setting the protocol treasury recipient and designated arbitrator.
     * @param _feeRecipient Payable address of the DAO fee collection treasury.
     * @param _arbitrator Address authorized to arbitrate and resolve transactional disputes.
     */
    constructor(address payable _feeRecipient, address _arbitrator) Ownable(msg.sender) {
        if (_feeRecipient == address(0) || _arbitrator == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
        arbitrator = _arbitrator;
    }

    // --- Core Transaction Functions ---

    /**
     * @notice Initializes a secure decentralized escrow lock by depositing native BOT tokens.
     * @param _onchainListingId Unique string reference to marketplace item metadata / IPFS hash.
     * @param _seller Designated merchant address who will fulfill delivery.
     * @return newId Numerical ID assigned to the newly created escrow contract order.
     */
    function createEscrow(
        string memory _onchainListingId,
        address payable _seller
    ) external payable nonReentrant whenNotPaused returns (uint256 newId) {
        if (_seller == address(0)) revert ZeroAddress();
        if (_seller == msg.sender) revert CannotBuyFromSelf();
        if (msg.value < 10000) revert InvalidAmount();
        if (activeListingIds[_onchainListingId]) revert ListingAlreadyEscrowed();

        _escrowCounter++;
        newId = _escrowCounter;

        uint256 calculatedFee = (msg.value * feePercentageBasisPoints) / 10000;
        uint256 expirationTime = block.timestamp + ESCROW_TIMEOUT_DURATION;

        _escrows[newId] = Escrow({
            id: newId,
            onchainListingId: _onchainListingId,
            buyer: payable(msg.sender),
            seller: _seller,
            amount: msg.value,
            protocolFee: calculatedFee,
            createdAt: block.timestamp,
            expiresAt: expirationTime,
            resolvedAt: 0,
            status: EscrowStatus.AWAITING_DELIVERY
        });

        activeListingIds[_onchainListingId] = true;

        _buyerEscrowIds[msg.sender].push(newId);
        _sellerEscrowIds[_seller].push(newId);

        emit EscrowCreated(newId, _onchainListingId, msg.sender, _seller, msg.value, calculatedFee, expirationTime);
        return newId;
    }

    /**
     * @notice Buyer confirms satisfactory product or DePIN hardware delivery, triggering token disbursement to seller.
     * @param _id Numerical ID of the awaiting escrow transaction to complete.
     */
    function confirmDelivery(uint256 _id) external nonReentrant onlyBuyer(_id) inStatus(_id, EscrowStatus.AWAITING_DELIVERY) {
        Escrow storage escrow = _escrows[_id];
        escrow.status = EscrowStatus.DELIVERED;
        escrow.resolvedAt = block.timestamp;
        activeListingIds[escrow.onchainListingId] = false;

        uint256 payout = escrow.amount - escrow.protocolFee;

        if (escrow.protocolFee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: escrow.protocolFee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        (bool sellerSuccess, ) = escrow.seller.call{value: payout}("");
        if (!sellerSuccess) revert TransferFailed();

        emit DeliveryConfirmed(_id, msg.sender, payout);
    }

    /**
     * @notice Expiry Fallback: Allows seller to claim payout if buyer goes unresponsive and the full 7-day timeout expires.
     * @param _id Numerical ID of the awaiting escrow order that has crossed expiration threshold.
     */
    function claimExpiredEscrow(uint256 _id) external nonReentrant onlySeller(_id) inStatus(_id, EscrowStatus.AWAITING_DELIVERY) {
        Escrow storage escrow = _escrows[_id];
        if (block.timestamp < escrow.expiresAt) revert EscrowNotYetExpired();

        escrow.status = EscrowStatus.EXPIRED_RELEASED;
        escrow.resolvedAt = block.timestamp;
        activeListingIds[escrow.onchainListingId] = false;

        uint256 payout = escrow.amount - escrow.protocolFee;

        if (escrow.protocolFee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: escrow.protocolFee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        (bool sellerSuccess, ) = escrow.seller.call{value: payout}("");
        if (!sellerSuccess) revert TransferFailed();

        emit EscrowExpired(_id, msg.sender, payout);
    }

    /**
     * @notice Initiates a formal arbitration dispute if fraud, Counterfeit hardware, or non-delivery occurs.
     * @param _id Numerical ID of the awaiting order to contest.
     */
    function openDispute(uint256 _id) external nonReentrant onlyPartyOrArbitrator(_id) inStatus(_id, EscrowStatus.AWAITING_DELIVERY) {
        _escrows[_id].status = EscrowStatus.DISPUTED;
        emit DisputeOpened(_id, msg.sender);
    }

    /**
     * @notice Arbitrator delivers a binding ruling on a disputed transaction, either executing payout to seller or refunding buyer.
     * @param _id Numerical ID of the disputed order to resolve.
     * @param _awardToSeller Ruling indicator (true releases net payment to seller, false returns total deposit to buyer without protocol fee deduction).
     */
    function resolveDispute(
        uint256 _id,
        bool _awardToSeller
    ) external nonReentrant inStatus(_id, EscrowStatus.DISPUTED) {
        if (msg.sender != arbitrator && msg.sender != owner()) revert UnauthorizedCaller();
        
        Escrow storage escrow = _escrows[_id];
        escrow.resolvedAt = block.timestamp;
        activeListingIds[escrow.onchainListingId] = false;

        if (_awardToSeller) {
            escrow.status = EscrowStatus.RESOLVED_SELLER;
            uint256 payout = escrow.amount - escrow.protocolFee;

            if (escrow.protocolFee > 0) {
                (bool feeSuccess, ) = feeRecipient.call{value: escrow.protocolFee}("");
                if (!feeSuccess) revert TransferFailed();
            }

            (bool success, ) = escrow.seller.call{value: payout}("");
            if (!success) revert TransferFailed();

            emit DisputeResolved(_id, true);
        } else {
            escrow.status = EscrowStatus.RESOLVED_BUYER;
            (bool success, ) = escrow.buyer.call{value: escrow.amount}("");
            if (!success) revert TransferFailed();

            emit DisputeResolved(_id, false);
        }
    }

    /**
     * @notice Allows a participating merchant to voluntarily cancel an awaiting order and disburse an immediate full refund to buyer.
     * @param _id Numerical ID of the awaiting order to cancel.
     */
    function cancelEscrowBySeller(uint256 _id) external nonReentrant onlySeller(_id) inStatus(_id, EscrowStatus.AWAITING_DELIVERY) {
        Escrow storage escrow = _escrows[_id];
        escrow.status = EscrowStatus.CANCELLED;
        escrow.resolvedAt = block.timestamp;
        activeListingIds[escrow.onchainListingId] = false;

        (bool success, ) = escrow.buyer.call{value: escrow.amount}("");
        if (!success) revert TransferFailed();

        emit EscrowCancelled(_id, msg.sender, escrow.amount);
    }

    // --- Admin & Configuration Methods ---

    /**
     * @notice Updates the protocol fee rate expressed in basis points. Restricted to protocol owner.
     * @param _newFeeBps Updated BPS rate (cannot exceed structural limit of 500 BPS / 5%).
     */
    function setFeePercentage(uint256 _newFeeBps) external onlyOwner {
        if (_newFeeBps > 500) revert FeeExceedsMaximum();
        uint256 oldFee = feePercentageBasisPoints;
        feePercentageBasisPoints = _newFeeBps;
        emit ProtocolFeeUpdated(oldFee, _newFeeBps);
    }

    /**
     * @notice Updates the destination treasury wallet for collected transaction fees. Restricted to protocol owner.
     * @param _newRecipient Payable cryptographic address of the new treasury recipient.
     */
    function setFeeRecipient(address payable _newRecipient) external onlyOwner {
        if (_newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _newRecipient;
    }

    /**
     * @notice Replaces the designated dispute arbitration authority wallet. Restricted to protocol owner.
     * @param _newArbitrator Cryptographic address of the new arbitrator.
     */
    function setArbitrator(address _newArbitrator) external onlyOwner {
        if (_newArbitrator == address(0)) revert ZeroAddress();
        address old = arbitrator;
        arbitrator = _newArbitrator;
        emit ArbitratorUpdated(old, _newArbitrator);
    }

    /**
     * @notice Trigger emergency protocol pause, freezing all new escrow deposits. Restricted to protocol owner.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Remove emergency protocol pause, restoring new escrow deposit capabilities. Restricted to protocol owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Frontend Getter & Query Helpers ---

    /**
     * @notice Fetch complete order parameters and timestamps for a single escrow transaction ID.
     * @param _id Numerical ID of the targeted escrow order.
     * @return Escrow Full structured order record from state storage.
     */
    function getEscrow(uint256 _id) external view returns (Escrow memory) {
        if (_id == 0 || _id > _escrowCounter) revert EscrowNotFound();
        return _escrows[_id];
    }

    /**
     * @notice Fetch an array of all complete order records where the specified address is designated as the purchasing buyer.
     * @param _buyer Cryptographic wallet address to query.
     * @return orders Complete typed array of matching Escrow order structs.
     */
    function getBuyerOrders(address _buyer) external view returns (Escrow[] memory) {
        uint256[] memory ids = _buyerEscrowIds[_buyer];
        Escrow[] memory orders = new Escrow[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            orders[i] = _escrows[ids[i]];
        }
        return orders;
    }

    /**
     * @notice Fetch an array of all complete order records where the specified address is designated as the merchant seller.
     * @param _seller Cryptographic wallet address to query.
     * @return orders Complete typed array of matching Escrow order structs.
     */
    function getSellerOrders(address _seller) external view returns (Escrow[] memory) {
        uint256[] memory ids = _sellerEscrowIds[_seller];
        Escrow[] memory orders = new Escrow[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            orders[i] = _escrows[ids[i]];
        }
        return orders;
    }

    /**
     * @notice Returns total cumulative numerical count of all generated escrow orders.
     * @return Total count of escrows created.
     */
    function getEscrowCount() external view returns (uint256) {
        return _escrowCounter;
    }
}
