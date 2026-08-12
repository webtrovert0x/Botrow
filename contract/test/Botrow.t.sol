// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Botrow.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BotrowTest is Test {
    Botrow public escrow;

    address payable public owner = payable(address(0x111));
    address payable public feeRecipient = payable(address(0x222));
    address public arbitrator = address(0x333);

    address payable public buyer = payable(address(0x444));
    address payable public seller = payable(address(0x555));
    address public attacker = address(0x999);

    uint256 constant ESCROW_AMOUNT = 10 ether; // 10 BOT Tokens

    // --- Mirror Events for expectEmit ---
    event EscrowCreated(
        uint256 indexed escrowId,
        string onchainListingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 protocolFee,
        uint256 expiresAt
    );
    event DeliveryConfirmed(uint256 indexed escrowId, address indexed buyer, uint256 sellerPayout);
    event DisputeOpened(uint256 indexed escrowId, address indexed initiator);
    event DisputeResolved(uint256 indexed escrowId, bool sellerWon);
    event EscrowExpired(uint256 indexed escrowId, address indexed releasedTo, uint256 payout);
    event EscrowCancelled(uint256 indexed escrowId, address indexed cancelledBy, uint256 refundAmount);

    function setUp() public {
        vm.prank(owner);
        escrow = new Botrow(feeRecipient, arbitrator);

        vm.deal(buyer, 10000 ether);
        vm.deal(seller, 100 ether);
        vm.deal(attacker, 50 ether);
        vm.deal(feeRecipient, 0 ether);
    }

    // ==========================================
    // 1. EVENT VERIFICATION TESTS ⭐⭐⭐⭐⭐
    // ==========================================

    function test_Event_EscrowCreated() public {
        uint256 expectedFee = (ESCROW_AMOUNT * 100) / 10000;
        uint256 expectedExpiry = block.timestamp + 7 days;

        vm.expectEmit(true, true, true, true);
        emit EscrowCreated(1, "ITEM_EVENT_TEST", buyer, seller, ESCROW_AMOUNT, expectedFee, expectedExpiry);

        vm.prank(buyer);
        escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_EVENT_TEST", seller);
    }

    function test_Event_DeliveryConfirmed() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_CONFIRM_EVENT", seller);
        uint256 expectedPayout = ESCROW_AMOUNT - ((ESCROW_AMOUNT * 100) / 10000);

        vm.expectEmit(true, true, true, true);
        emit DeliveryConfirmed(escrowId, buyer, expectedPayout);

        vm.prank(buyer);
        escrow.confirmDelivery(escrowId);
    }

    function test_Event_DisputeOpenedAndResolved() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_DISPUTE_EVENT", seller);

        vm.expectEmit(true, true, true, true);
        emit DisputeOpened(escrowId, seller);

        vm.prank(seller);
        escrow.openDispute(escrowId);

        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(escrowId, true);

        vm.prank(arbitrator);
        escrow.resolveDispute(escrowId, true);
    }

    function test_Event_EscrowCancelled() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_CANCEL_EVENT", seller);

        vm.expectEmit(true, true, true, true);
        emit EscrowCancelled(escrowId, seller, ESCROW_AMOUNT);

        vm.prank(seller);
        escrow.cancelEscrowBySeller(escrowId);
    }

    function test_Event_EscrowExpired() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_EXPIRED_EVENT", seller);
        uint256 expectedPayout = ESCROW_AMOUNT - ((ESCROW_AMOUNT * 100) / 10000);

        vm.warp(block.timestamp + 7 days + 1);

        vm.expectEmit(true, true, true, true);
        emit EscrowExpired(escrowId, seller, expectedPayout);

        vm.prank(seller);
        escrow.claimExpiredEscrow(escrowId);
    }

    // ==========================================
    // 2. UNAUTHORIZED ACCESS & SECURITY TESTS
    // ==========================================

    function test_Revert_Unauthorized_ConfirmDeliveryBySeller() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_AUTH_1", seller);

        // Seller cannot confirm their own delivery
        vm.prank(seller);
        vm.expectRevert(Botrow.UnauthorizedCaller.selector);
        escrow.confirmDelivery(escrowId);
    }

    function test_Revert_Unauthorized_CancelByBuyer() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_AUTH_2", seller);

        // Buyer cannot arbitrarily cancel an active order
        vm.prank(buyer);
        vm.expectRevert(Botrow.UnauthorizedCaller.selector);
        escrow.cancelEscrowBySeller(escrowId);
    }

    function test_Revert_Unauthorized_ResolveDispute() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_AUTH_3", seller);

        vm.prank(buyer);
        escrow.openDispute(escrowId);

        // Attacker or buyer cannot arbitrate their own dispute
        vm.prank(attacker);
        vm.expectRevert(Botrow.UnauthorizedCaller.selector);
        escrow.resolveDispute(escrowId, false);
    }

    function test_Revert_Unauthorized_ClaimExpiredByBuyer() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_AUTH_4", seller);
        vm.warp(block.timestamp + 7 days + 1);

        // Only seller can claim timed out escrow
        vm.prank(buyer);
        vm.expectRevert(Botrow.UnauthorizedCaller.selector);
        escrow.claimExpiredEscrow(escrowId);
    }

    function test_Revert_Unauthorized_Pause() public {
        vm.prank(attacker);
        vm.expectRevert(); // Enforced by OpenZeppelin Ownable
        escrow.pause();
    }

    // ==========================================
    // 3. PROPERTY & FUZZ TESTING ⭐⭐⭐⭐⭐
    // ==========================================

    /**
     * @notice Fuzz tests creation across arbitrary BOT token amounts, proving mathematical fee precision.
     */
    function testFuzz_CreateEscrow(uint96 amount) public {
        vm.assume(amount >= 10000 && amount <= 5000 ether);

        address randBuyer = address(0x8888);
        vm.deal(randBuyer, uint256(amount));

        vm.prank(randBuyer);
        uint256 id = escrow.createEscrow{value: amount}("ITEM_FUZZ_TEST", seller);

        Botrow.Escrow memory item = escrow.getEscrow(id);
        uint256 expectedFee = (uint256(amount) * 100) / 10000;

        assertEq(item.amount, amount);
        assertEq(item.protocolFee, expectedFee);
        assertEq(address(escrow).balance, amount);
    }

    /**
     * @notice Fuzz test proving that for any random deposit amount, payout plus fee always equals gross deposit without value leakage.
     */
    function testFuzz_ConfirmDelivery_FeeSplitting(uint96 amount) public {
        vm.assume(amount >= 10000 && amount <= 5000 ether);
        vm.deal(buyer, uint256(amount));

        uint256 sellerInitial = seller.balance;
        uint256 feeRecipientInitial = feeRecipient.balance;

        vm.prank(buyer);
        uint256 id = escrow.createEscrow{value: amount}("ITEM_FUZZ_SPLIT", seller);

        vm.prank(buyer);
        escrow.confirmDelivery(id);

        uint256 sellerGain = seller.balance - sellerInitial;
        uint256 feeGain = feeRecipient.balance - feeRecipientInitial;

        // Proves strict value conservation across all token magnitudes!
        assertEq(sellerGain + feeGain, amount);
        assertEq(address(escrow).balance, 0);
    }

    // ==========================================
    // 4. CORE FUNCTIONAL & GETTER TESTS
    // ==========================================

    function test_Revert_DuplicateListingId() public {
        vm.prank(buyer);
        escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_UNIQUE_DEPIN", seller);

        vm.prank(buyer);
        vm.expectRevert(Botrow.ListingAlreadyEscrowed.selector);
        escrow.createEscrow{value: ESCROW_AMOUNT}("ITEM_UNIQUE_DEPIN", seller);
    }

    function test_FrontendGetters_BuyerAndSellerOrders() public {
        vm.prank(buyer);
        escrow.createEscrow{value: 5 ether}("ITEM_GET_1", seller);

        vm.prank(buyer);
        escrow.createEscrow{value: 10 ether}("ITEM_GET_2", seller);

        Botrow.Escrow[] memory buyerOrders = escrow.getBuyerOrders(buyer);
        Botrow.Escrow[] memory sellerOrders = escrow.getSellerOrders(seller);

        assertEq(buyerOrders.length, 2);
        assertEq(sellerOrders.length, 2);
        assertEq(buyerOrders[0].onchainListingId, "ITEM_GET_1");
        assertEq(sellerOrders[1].onchainListingId, "ITEM_GET_2");
    }
}
