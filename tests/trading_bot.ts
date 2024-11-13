import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TradingBot } from "../target/types/trading_bot";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Market } from '@project-serum/serum';
import { getPoolInfo, getTokenPrice as getRaydiumPrice } from "@raydium-io/raydium-sdk";
import { getSaberPoolData, getTokenPrice as getSaberPrice } from '@saberhq/saber-sdk';

const SOLEND_FLASHLOAN_PROGRAM_ID = new anchor.web3.PublicKey('ALend7Ketfx5bxh6ghsCDXAoDrhvEmsXT3cynB6aPLgx');
const serumMarketAddress = new anchor.web3.PublicKey("6ibUz1BqSD3f8XP4wEGwoRH4YbYRZ1KDZBeXmrp3KosD");
const raydiumPoolAddress = new anchor.web3.PublicKey("3nMFwZXwY1s1M5s8vYAHqd4wGs4iSxXE4LRoUMMYqEgF");
const saberPoolAddress = new anchor.web3.PublicKey("SABER_POOL_ADDRESS");

/******* Fetching Serum Prices *******/
async function fetchSerumPrices(connection: anchor.web3.Connection) {
  const market = await Market.load(connection, serumMarketAddress, {}, new anchor.web3.PublicKey('DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY'));
  const bids = await market.loadBids(connection);
  const asks = await market.loadAsks(connection);

  const bestBid = bids.getL2(1);
  const bestAsk = asks.getL2(1);

  const bidPrice = bestBid[0][0] / 10**6; // Adjusting decimals for the token (if necessary)
  const askPrice = bestAsk[0][0] / 10**6; // Adjusting decimals for the token (if necessary)

  console.log(`Serum Best Bid: $${bidPrice}, Best Ask: $${askPrice}`);
  return { bidPrice, askPrice };
}

/******* Fetching Raydium Prices *******/
async function fetchRaydiumPrices(connection: anchor.web3.Connection) {
  const raydiumPool = await getPoolInfo(connection, raydiumPoolAddress);
  const raydiumPrice = await getRaydiumPrice(connection, raydiumPool);
  console.log(`Raydium Price: $${raydiumPrice}`);
  return raydiumPrice;
}

/******* Fetching Saber Prices *******/
async function fetchSaberPrices(connection: anchor.web3.Connection) {
  const saberPool = await getSaberPoolData(connection, saberPoolAddress);
  const saberPrice = await getSaberPrice(saberPool);
  console.log(`Saber Price: $${saberPrice}`);
  return saberPrice;
}

describe("trading_bot", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TradingBot as Program<TradingBot>;

  it("Buying and Selling in the same transaction...", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const seller = anchor.web3.Keypair.generate();

    // Airdrop SOL to the buyer for testing purposes
    const airdropSig = await provider.connection.requestAirdrop(buyer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSig);

    // Fetch prices from Serum, Raydium, and Saber
    const serumPrices = await fetchSerumPrices(provider.connection);
    const raydiumPrice = await fetchRaydiumPrices(provider.connection);
    const saberPrice = await fetchSaberPrices(provider.connection);

    // Define actions (You could use the fetched prices to define trading conditions)
    const buyAction = { buy: {} };
    const sellAction = { sell: {} };

    try {
      // Pass both actions as an array
      const tx = await program.methods
        .trade([buyAction, sellAction], new anchor.BN(1000))  // Adjust the amount as needed
        .accounts({
          buyer: buyer.publicKey,
          seller: seller.publicKey,
          borrower: buyer.publicKey,
          flashloan: seller.publicKey,
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
