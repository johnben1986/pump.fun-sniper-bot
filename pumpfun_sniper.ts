import dotenv from "dotenv"
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL
} from "@solana/web3.js"
import { PumpFunSDK, DEFAULT_DECIMALS } from "pumpdotfun-sdk"
import { AnchorProvider, Wallet } from "@coral-xyz/anchor"
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token"
import bs58 from "bs58"
import {
  getTokenAccounts,
} from './liquidity';
dotenv.config()

// config area
const SLIPPAGE_BASIS_POINTS = BigInt(
  process.env.SLIPPAGE_BASIS_POINTS || "2000"
)
const RPC_URL = process.env.RPC_ENDPOINT;
const UNIT_PRICE_LAMPORTS = Number(process.env.UNIT_PRICE_LAMPORTS || "")
const UNIT_LIMIT_LAMPORTS = Number(process.env.UNIT_LIMIT_LAMPORTS || "")
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""
const QUOTE_AMOUNT = process.env.QUOTE_AMOUNT;
const TAKE_PROFIT_PERCENTAGE = Number(process.env.TAKE_PROFIT_PERCENTAGE);

if (!PRIVATE_KEY) {
  throw new Error("Please set PRIVATE_KEY in .env file")
}

const getProvider = wallet => {
  if (!RPC_URL) {
    throw new Error("Please set RPC_URL in .env file")
  }

  const connection = new Connection(RPC_URL, "confirmed")
  return new AnchorProvider(connection, wallet, { commitment: "finalized" })
}

let wallet: Keypair;
wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));

const privateKey = bs58.decode(PRIVATE_KEY)
const buyerKeypair = Keypair.fromSecretKey(privateKey)
const provider = getProvider(new Wallet(wallet))
const sdk = new PumpFunSDK(provider)
const connection = provider.connection

const RAYDIUM_PUBLIC_KEY = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";//Pump mint address
const raydium = new PublicKey(RAYDIUM_PUBLIC_KEY);

///////////////////////////////////--BUY--//////////////////////////////////////
async function buyCoin(currentTokenCA, solAmount, qoutevault, basevault) {
  
  try {

    const BUY_AMOUNT_SOL= parseFloat(solAmount);
    console.log("Buying...")

    const currentSolBalance = await connection.getBalance(
      buyerKeypair.publicKey
    )
    if (
      currentSolBalance <
      BUY_AMOUNT_SOL * LAMPORTS_PER_SOL + 0.003 * LAMPORTS_PER_SOL
    ) {
      throw new Error(
        `Insufficient SOL balance. Please fund the buyer account with at least ${(
          BUY_AMOUNT_SOL + 0.001
        ).toFixed(3)} SOL.`
      )
    }

    const buyAmountSol = BUY_AMOUNT_SOL * LAMPORTS_PER_SOL
    await sdk.buy(
      buyerKeypair,
      new PublicKey(currentTokenCA),
      BigInt(buyAmountSol),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: UNIT_LIMIT_LAMPORTS,
        unitPrice: UNIT_PRICE_LAMPORTS
      },
      "confirmed",
      "finalized"
    )

    await new Promise(resolve => setTimeout(resolve, 5000))

    const balanceSpl = await getTokenBalanceSpl(currentTokenCA, buyerKeypair.publicKey.toString());
    const bal = Number(balanceSpl) / 1000000;

    if (bal > 0) {
        const sol_curve = await sdk.getBondingCurveAccount(new PublicKey(currentTokenCA), 'confirmed');
        const sol_reserve = Number(sol_curve.realSolReserves) / LAMPORTS_PER_SOL;
      return { price: sol_reserve, amount: bal}
    } else {
        console.log("Purchase failed or zero tokens received.")
    }
  } catch (error) {
    console.log("Error during buying:", error)
  }
  return { success: false, amount: 0 }
}
//////////////////////////////////////--SELL--///////////////////////////////
async function sellCoin(currentTokenCA, amountToSell) {
  
  try {

    const token_decimals = await total_supply(currentTokenCA);
    console.log("Selling... Amount: "+ amountToSell);
    const sellAmount = parseFloat(amountToSell);
    const finalSellAmount = sellAmount * token_decimals;

    await sdk.sell(
      buyerKeypair,
      new PublicKey(currentTokenCA),
      BigInt(finalSellAmount),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: UNIT_LIMIT_LAMPORTS,
        unitPrice: UNIT_PRICE_LAMPORTS
      },
      "confirmed",
      "finalized"
    )

    console.log(`Sell successful.`)
    return { sold: amountToSell}
  } catch (error) {

    console.log("Failed to sell tokens: Retrying....")
    const token_decimals = await total_supply(currentTokenCA);
    const sellAmount = parseFloat(amountToSell);
    const finalSellAmount = sellAmount * token_decimals;

    await sdk.sell(
      buyerKeypair,
      new PublicKey(currentTokenCA),
      BigInt(finalSellAmount),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: UNIT_LIMIT_LAMPORTS,
        unitPrice: UNIT_PRICE_LAMPORTS
      },
      "confirmed",
      "finalized"
    )

    console.log(`Sell successful.`)
    return { sold: amountToSell}
    //return { sold: false, remainingTokens: 0 }
  }
}

//Get Mint total supply
async function total_supply(mint) {
  
  const mintss = new PublicKey(mint);
  const mintInfo = await getMint(
    connection,
    mintss
  )

  const mints = await connection.getParsedAccountInfo(mintss);
  let obj = JSON.stringify(mints.value?.data);
  if (obj.includes('\"decimals\":6')){
    var total_supp = Number(mintInfo.supply) / 1000000;
    return 1000000;
  }else if (obj.includes('\"decimals\":3')){
    var total_supp = Number(mintInfo.supply) / 1000;
    return 1000;
  }else if (obj.includes('\"decimals\":8')){
    var total_supp = Number(mintInfo.supply) / 100000000;
    return 100000000;
  }else if (obj.includes('\"decimals\":1')){
    var total_supp = Number(mintInfo.supply) / 10;
    return 10;
  }
  else if (obj.includes('\"decimals\":5')){
    var total_supp = Number(mintInfo.supply) / 100000;
    return 100000;
  }
  else if (obj.includes('\"decimals\":4')){
    var total_supp = Number(mintInfo.supply) / 10000;
    return 10000;
  }
  else if (obj.includes('\"decimals\":7')){
    var total_supp = Number(mintInfo.supply) / 10000000;
    return 10000000;
  }
  else if (obj.includes('\"decimals\":9')){
    var total_supp = Number(mintInfo.supply) / 1000000000;
    return 1000000000;
  }else{
    var total_supp = Number(mintInfo.supply) / LAMPORTS_PER_SOL;
    return LAMPORTS_PER_SOL;
  }
  
}

async function fetchRaydiumAccounts(txId) {

    const tx = await connection.getParsedTransaction(
        txId,
        {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

      const account =  tx?.transaction.message.instructions.find((ix) => ix.programId.toBase58() == RAYDIUM_PUBLIC_KEY);
  if (account) {
          
    try {
      const json = JSON.stringify(account, null, 2);
      const accounts = JSON.parse(json);

      const Mint = accounts.accounts[0];
      const Dev = accounts.accounts[7];
      const qoutevault = accounts.accounts[2];
      const basevault = accounts.accounts[3];
      const mint = new PublicKey(Mint);

      const pumpf = JSON.stringify(tx.meta.innerInstructions[2].instructions[2]);
      const destination_address = pumpf.toString().split('"')[7];
      
      if (destination_address == "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM") {
        const displayData = [
          { "Token": "Dev","Public Key": Dev },
          { "Token": "Token", "Public Key": Mint },
          { "Token": "Link", "Public Key": 'https://pump.fun/' + Mint },
        ];

          console.table(displayData);
          let buy_price = await buyCoin(Mint, QUOTE_AMOUNT, qoutevault, basevault);

          var STPL1 = TAKE_PROFIT_PERCENTAGE / 100;
          var STPLSS1 = buy_price.price * STPL1;
          var profit = buy_price.price + STPLSS1;

          let counter: number = 0;

          while (buy_price.price > 0) {
              
            const sol_curves = await sdk.getBondingCurveAccount(mint, 'confirmed');
            const sol_reserves = Number(sol_curves.realSolReserves) / LAMPORTS_PER_SOL;
              
            counter++;              
              
            process.stdout.write('Current : ' + sol_reserves + '| Target Profit: '+ profit);
            process.stdout.clearLine;
            process.stdout.cursorTo(0);
            process.stdout.write('');
            
          if (sol_reserves >= profit) {
            //SELL HERE
            let sell_result = await sellCoin(Mint, buy_price.amount);
            console.log('Take Profit Sold ' + sell_result.sold);
            break;
          }
          }
      } 
      
    } catch (err) {
      console.log(err);
    }
  }
}

//Listen the pumpfun pool
const runListener = async () => {

    try {
        connection.onLogs(
            raydium,
            ({ logs, err, signature }) => {
                if (err) return;
                if (logs && logs.some(log => log.includes("InitializeMint2"))) {
                    fetchRaydiumAccounts(signature);
              }
            },
            "confirmed"
        );

    } catch {
        console.log('error');
    }
}

async function getTokenBalanceSpl(mint, dev) {
  const Mint = new PublicKey(dev);
  const tokenAccounts = await getTokenAccounts(connection, Mint , 'confirmed');

  for (const ta of tokenAccounts) {
    if (ta.accountInfo.mint.toString()==mint.toString()){
      const amount = ta.accountInfo.amount;
      return amount;
    }
  }
}

runListener();