import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradingBot } from "../target/types/trading_bot";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const SOLEND_FLASHLOAN_PROGRAM_ID = new anchor.web3.PublicKey('ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx');

describe("trading_bot", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TradingBot as Program<TradingBot>;
  let listener: number;
  let flashloanListener: number;

  before(async () => {
    listener = program.addEventListener("tradeActionEvent", (event, slot) => {
      console.log("Trade Event object", event);
      console.log("Slot", slot);
    });

    flashloanListener = program.addEventListener("flashloanEvent", (event, slot) => {
      console.log("Flashloan Event object", event);
      console.log("Flashloan Slot", slot);
    });
  });

  after(async () => {
    await program.removeEventListener(listener);
    await program.removeEventListener(flashloanListener);
  });

  it("Buying and Selling in the same transaction...", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const seller = anchor.web3.Keypair.generate();

    // Airdrop SOL to the buyer for testing purposes
    const airdropSig = await provider.connection.requestAirdrop(buyer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSig);

    // Define actions
    const buyAction = { buy: {} };
    const sellAction = { sell: {} };

    try {
      // Pass both actions as an array
      const tx = await program.methods
        .trade([buyAction, sellAction], new anchor.BN(1000)) // Ensure amount is passed as BN
        .accounts({
          buyer: buyer.publicKey,
          seller: seller.publicKey,
          borrower: buyer.publicKey,
          flashloan: seller.publicKey,
          flashloanProgram: SOLEND_FLASHLOAN_PROGRAM_ID, // This should be TOKEN_PROGRAM_ID
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