import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradingBot } from "../target/types/trading_bot";

describe("trading_bot", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TradingBot as Program<TradingBot>;
  let listener: number;


  before(async () => {
    listener = program.addEventListener("tradeActionEvent", (event, slot) => {
      console.log("Full Event object", event);
      console.log("Slot", slot);
    })
  })

  after(async () => {
    await program.removeEventListener(listener);
  })


  it("Buying and Selling in the same transaction...", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const seller = anchor.web3.Keypair.generate();

    // Airdrop SOL to the buyer for testing purposes
    await provider.connection.requestAirdrop(buyer.publicKey, 1000000000);

    // Pass both actions as an array
    const tx = await program.methods
      .trade([{ buy: {} }, { sell: {} }]) // Array with both buy and sell actions
      .accounts({
        buyer: buyer.publicKey,
        seller: seller.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    console.log("Transaction signature: ", tx);
  });
});
