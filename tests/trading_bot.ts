import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradingBot } from "../target/types/trading_bot";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";

// Solend Flashloan Program ID on Devnet
const SOLEND_FLASHLOAN_PROGRAM_ID = new anchor.web3.PublicKey(
  "ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx"
);

// Pyth Program ID on Devnet
const PYTH_PROGRAM_ID = new anchor.web3.PublicKey(
  "CqFJLrT4rSpA46RQkVYWn8tdBDuQ7p7RXcp6Um76oaph"
);

// Switchboard Program ID on Devnet
const SWITCHBOARD_PROGRAM_ID = new anchor.web3.PublicKey(
  "7azgmy1pFXHikv36q1zZASvFq5vFa39TT9NweVugKKTU"
);

// Lending Market Account on Devnet
const LENDING_MARKET = new anchor.web3.PublicKey(
  "GvjoVKNjBvQcFaSKUW1gTE7DxhSpjHbE69umVR5nPuQp"
);

// Reserve Accounts on Devnet
const RESERVES: { [key: string]: anchor.web3.PublicKey } = {
  SOL: new anchor.web3.PublicKey("5VVLD7BQp8y3bTgyF5ezm1ResyMTR3PhYsT4iHFU8Sxz"),
  USDC: new anchor.web3.PublicKey("FNNkz4RCQezSSS71rW2tvqZH1LCkTzaiG7Nd1LeA5x5y"),
  ETH: new anchor.web3.PublicKey("CuQcLfN3iTWqyEEbAHNZp7awChbR4KQPFJsTUhsAxrcu"),
  BTC: new anchor.web3.PublicKey("FNXBRv3saDgVoaoDLV5ho28D4AvZikG9r7QpThTLak9f"),
  SRM: new anchor.web3.PublicKey("5YKmMZcuWEdF5NavNK4MgKPRhnhw6jq22zwcdh1dvxbd"),
  USDT: new anchor.web3.PublicKey("ERm3jhg8J94hxr7KmhkRvnuYbKZgNFEL4hXzBMeb1rQ8"),
  soFTT: new anchor.web3.PublicKey("8eUYeEiGXRMN7V9Xx7CehwSRfJB9iQfJW249zX1z7Uue"),
  RAY: new anchor.web3.PublicKey("FpKhrtU6nDjEcAi3SsSevRRgPzirLkZpmXD6nfeb7k8c"),
  SBR: new anchor.web3.PublicKey("5CXDzn4AygQwu59gxo34T965BmYMHuGvAuoRMeRBKg4"),
  MER: new anchor.web3.PublicKey("HbXi7Gpe5GXzE7V1SjEEy3sDurmFi7RbTvCZ3Rd7Nv6b"),
  mSOL: new anchor.web3.PublicKey("Ei2dC7hFxBhVq5pn4qNJLMxKBSojx7p7wnNoBz4HELKG"),
};

// Load your specific keypairs
const loadKeypair = (path: string): anchor.web3.Keypair => {
  const secretKey = JSON.parse(fs.readFileSync(path, "utf8"));
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
};

const buyerKeypairPath = "/home/linkan/.config/solana/id.json";
const sellerKeypairPath = "/home/linkan/.config/solana/id.json";

const buyer = loadKeypair(buyerKeypairPath);
const seller = loadKeypair(sellerKeypairPath);

describe("trading_bot", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TradingBot as Program<TradingBot>;

  it("Buying and Selling in the same transaction...", async () => {
    // Derive the PDA for the flashloan account based on the "flashloan-seed"
    const [flashloanPda, flashloanBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("flashloan-seed")],
      program.programId
    );

    // Select a Reserve for testing (e.g., SOL)
    const selectedReserve = "SOL";
    const reservePubkey = RESERVES[selectedReserve];

    // **Important:** You need to obtain the actual Source Liquidity Account for the selected reserve.
    // For demonstration, we'll use the reservePubkey as sourceLiquidity.
    // Replace this with the actual liquidity supply account in your setup.
    const sourceLiquidity = reservePubkey; // Replace with actual Source Liquidity Account

    // **Important:** You need to obtain the Lending Market Authority for the Lending Market.
    // This is typically a PDA derived from the Lending Market.
    // For demonstration, we'll generate a dummy public key.
    // Replace this with the actual Lending Market Authority in your setup.
    const lendingMarketAuthority = new anchor.web3.PublicKey(
      "LendingMarketAuthPubKey1234567890ABCD" // Replace with actual Lending Market Authority Public Key
    );

    // Example: Destination Liquidity Account (Buyer's token account)
    // **Ensure this account exists and is initialized as a token account for the selected token.**
    // For demonstration, we'll generate a dummy public key.
    const destinationLiquidity = new anchor.web3.PublicKey(
      "3eMAiDwC3BBw6Qa2jANNTtdZc4kngif8Vtfz54qNq7xJ" // Replace with actual Destination Liquidity Public Key
    );

    // Define actions
    const buyAction = { buy: {} };
    const sellAction = { sell: {} };

    try {
      const tx = await program.methods
        .trade([buyAction, sellAction], new anchor.BN(100)) // Adjust the amount as needed
        .accounts({
          buyer: buyer.publicKey,
          seller: seller.publicKey,
          borrower: buyer.publicKey,
          flashloan: flashloanPda,
          flashloanProgram: SOLEND_FLASHLOAN_PROGRAM_ID,
          sourceLiquidity: sourceLiquidity,
          destinationLiquidity: destinationLiquidity,
          reserve: reservePubkey,
          lendingMarket: LENDING_MARKET,
          lendingMarketAuthority: lendingMarketAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      console.log("Transaction signature: ", tx);
    } catch (err) {
      if (err.logs) {
        console.error("Transaction simulation failed.");
        console.error(err.logs);
      } else {
        console.error("An unexpected error occurred:", err);
      }
    }
  });
});
