export const BOTROW_CONTRACT_ADDRESS = "0x64aa9C9FFded25b5DF458689e6fE48980AC4D2b8" as const;

// Treasury wallet that receives the 0.1 BOT seller listing registration fee
// Update this to your actual DAO treasury wallet before mainnet launch
export const LISTING_FEE_RECIPIENT = "0x293ed7F710D056887C6e3Ef5EdBC9B95e32f03a4" as const;
export const LISTING_FEE_AMOUNT = "0.1"; // BOT

export const BOTROW_ABI = [
  // State Mutating Functions
  {
    inputs: [
      { internalType: "string", name: "_onchainListingId", type: "string" },
      { internalType: "address payable", name: "_seller", type: "address" }
    ],
    name: "createEscrow",
    outputs: [{ internalType: "uint256", name: "escrowId", type: "uint256" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "_id", type: "uint256" }],
    name: "confirmDelivery",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "_id", type: "uint256" }],
    name: "claimExpiredEscrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "_id", type: "uint256" }],
    name: "openDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_id", type: "uint256" },
      { internalType: "bool", name: "_awardToSeller", type: "bool" }
    ],
    name: "resolveDispute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "_id", type: "uint256" }],
    name: "cancelEscrowBySeller",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },

  // View Getters & Frontend Array Helpers
  {
    inputs: [{ internalType: "uint256", name: "_id", type: "uint256" }],
    name: "getEscrow",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "string", name: "onchainListingId", type: "string" },
          { internalType: "address payable", name: "buyer", type: "address" },
          { internalType: "address payable", name: "seller", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "protocolFee", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "expiresAt", type: "uint256" },
          { internalType: "enum Botrow.EscrowStatus", name: "status", type: "uint8" }
        ],
        internalType: "struct Botrow.Escrow",
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "_buyer", type: "address" }],
    name: "getBuyerOrders",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "string", name: "onchainListingId", type: "string" },
          { internalType: "address payable", name: "buyer", type: "address" },
          { internalType: "address payable", name: "seller", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "protocolFee", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "expiresAt", type: "uint256" },
          { internalType: "enum Botrow.EscrowStatus", name: "status", type: "uint8" }
        ],
        internalType: "struct Botrow.Escrow[]",
        name: "",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "_seller", type: "address" }],
    name: "getSellerOrders",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "string", name: "onchainListingId", type: "string" },
          { internalType: "address payable", name: "buyer", type: "address" },
          { internalType: "address payable", name: "seller", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "protocolFee", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "expiresAt", type: "uint256" },
          { internalType: "enum Botrow.EscrowStatus", name: "status", type: "uint8" }
        ],
        internalType: "struct Botrow.Escrow[]",
        name: "",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "escrowId", type: "uint256" },
      { indexed: false, internalType: "string", name: "onchainListingId", type: "string" },
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: true, internalType: "address", name: "seller", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "protocolFee", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "expiresAt", type: "uint256" }
    ],
    name: "EscrowCreated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "escrowId", type: "uint256" },
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: false, internalType: "uint256", name: "sellerPayout", type: "uint256" }
    ],
    name: "DeliveryConfirmed",
    type: "event"
  }
] as const;
