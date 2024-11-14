import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradingBot } from "../target/types/trading_bot";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const SOLEND_FLASHLOAN_PROGRAM_ID = new anchor.web3.PublicKey('ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx');

describe("trading_bot", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TradingBot as Program<TradingBot>;

  it("Buying and Selling in the same transaction...", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const seller = anchor.web3.Keypair.generate();

    // Derive the PDA for the flashloan account based on the "flashloan-seed"
    const [flashloanPda, flashloanBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("flashloan-seed")],
      program.programId
    );

    // Define actions (these are placeholders; adjust based on your program logic)
    const buyAction = { buy: {} };
    const sellAction = { sell: {} };

    try {
      // Pass both actions as an array and use the derived PDA for the flashloan account
      const tx = await program.methods
        .trade([buyAction, sellAction], new anchor.BN(1000)) // Adjust the amount as needed
        .accounts({
          buyer: buyer.publicKey,
          seller: seller.publicKey,
          borrower: buyer.publicKey,
          flashloan: flashloanPda, // Use the derived PDA here
          flashloanProgram: SOLEND_FLASHLOAN_PROGRAM_ID,
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
