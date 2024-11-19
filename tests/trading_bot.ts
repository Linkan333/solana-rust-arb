import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradingBot } from "../target/types/trading_bot";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";


// Solend Flashloan Program ID on Devnet
const SOLEND_FLASHLOAN_PROGRAM_ID = new anchor.web3.PublicKey(
  "ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx"
);

// Reserves on Devnet
const RESERVES: { [key: string]: anchor.web3.PublicKey } = {
  SOL: new anchor.web3.PublicKey("5VVLD7BQp8y3bTgyF5ezm1ResyMTR3PhYsT4iHFU8Sxz"),
};

// Load keypairs from file
const loadKeypair = (path: string): anchor.web3.Keypair => {
  const secretKeyString = fs.readFileSync(path, "utf8");
  const secretKey = JSON.parse(secretKeyString);

  if (!Array.isArray(secretKey)) {
    throw new Error(`Invalid keypair format in ${path}. Expected an array of numbers.`);
  }

  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
};

// Paths to buyer and seller keypairs
const buyerKeypairPath = "/home/linkan/.config/solana/id.json";
const sellerKeypairPath = "/home/linkan/.config/solana/id.json";

// Load keypairs
const buyer = loadKeypair(buyerKeypairPath);
const seller = loadKeypair(sellerKeypairPath);

// Fixed Lending Market Public Key for Devnet
const LENDING_MARKET_PUBLIC_KEY = new anchor.web3.PublicKey("GvjoVKNjBvQcFaSKUW1gTE7DxhSpjHbE69umVR5nPuQp");

(async () => {
  // Derive Lending Market Authority Public Key
  const [LENDING_MARKET_AUTHORITY_PUBLIC_KEY] = await anchor.web3.PublicKey.findProgramAddress(
    [LENDING_MARKET_PUBLIC_KEY.toBuffer()],
    SOLEND_FLASHLOAN_PROGRAM_ID
  );

  describe("trading_bot", () => {
    // Configure the client to use the Devnet cluster.
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

      if (!reservePubkey) {
        throw new Error(`Reserve for ${selectedReserve} not found.`);
      }

      // Destination Liquidity Account (Buyer's token account)
      const destinationLiquidity = new anchor.web3.PublicKey(
        "3eMAiDwC3BBw6Qa2jANNTtdZc4kngif8Vtfz54qNq7xJ" // Replace with actual Destination Liquidity Public Key
      );

      // Define actions
      const buyAction = { buy: {} };
      const sellAction = { sell: {} };

      try {
        console.log("Preparing transaction for buying and selling...");
        console.log("Lending Market Public Key:", LENDING_MARKET_PUBLIC_KEY.toBase58());
        console.log("Lending Market Authority Public Key:", LENDING_MARKET_AUTHORITY_PUBLIC_KEY.toBase58());
        console.log("Reserve Public Key:", reservePubkey.toBase58());
        console.log("Destination Liquidity Public Key:", destinationLiquidity.toBase58());

        const tx = await program.methods
          .trade([buyAction, sellAction], new anchor.BN(100)) // Adjust the amount as needed
          .accounts({
            buyer: buyer.publicKey,
            seller: seller.publicKey,
            borrower: buyer.publicKey,
            flashloan: flashloanPda,
            flashloanProgram: SOLEND_FLASHLOAN_PROGRAM_ID,
            sourceLiquidity: reservePubkey,
            destinationLiquidity: destinationLiquidity,
            reserve: reservePubkey,
            lendingMarket: LENDING_MARKET_PUBLIC_KEY,
            lendingMarketAuthority: LENDING_MARKET_AUTHORITY_PUBLIC_KEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        console.log("Transaction signature:", tx);
      } catch (err: any) {
        console.error("An error occurred during transaction execution:", err);
        console.log("Buyer Public Key:", buyer.publicKey.toBase58());
        console.log("Seller Public Key:", seller.publicKey.toBase58());
        console.log("Reserve Public Key:", reservePubkey.toBase58());
        console.log("Flashloan PDA:", flashloanPda.toBase58());
        console.log("Lending Market Public Key:", LENDING_MARKET_PUBLIC_KEY.toBase58());
        console.log("Lending Market Authority Public Key:", LENDING_MARKET_AUTHORITY_PUBLIC_KEY.toBase58());
        console.log("Destination Liquidity Public Key:", destinationLiquidity.toBase58());
        
        if (err.logs) {
          console.error("Transaction simulation logs:", err.logs);
        }
        throw err;
      }
    });
  });
})();