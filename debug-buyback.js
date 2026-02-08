const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deploymentPath = "deploy/deployment-modular.json";
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const treasuryAddr = deployment.contracts.DreamTreasury;

    console.log("Checking Treasury at:", treasuryAddr);

    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);

    // 1. Check Config
    const enabled = await treasury.buybackEnabled();
    const percent = await treasury.buybackPercent();
    const slippage = await treasury.buybackSlippage();
    const router = await treasury.swapRouter();
    const wbnb = await treasury.wbnb();
    const wish = await treasury.wishToken();

    console.log("\n[Config]");
    console.log("Buyback Enabled:", enabled);
    console.log("Buyback Percent:", percent.toString());
    console.log("Slippage:", slippage.toString());
    console.log("Router:", router);
    console.log("WBNB:", wbnb);
    console.log("WISH:", wish);

    // 2. Check Balance
    const WISH = await hre.ethers.getContractAt("IERC20", wish);
    const balance = await WISH.balanceOf(treasuryAddr);
    console.log("\nCurrent Treasury WISH Balance:", hre.ethers.formatEther(balance));

    const bnbBal = await hre.ethers.provider.getBalance(treasuryAddr);
    console.log("Current Treasury BNB Balance:", hre.ethers.formatEther(bnbBal));

    // 3. Check Events (Last 1000 blocks)
    console.log("\n[Events - Last 1000 Blocks]");
    const currentBlock = await hre.ethers.provider.getBlockNumber();
    const filter = treasury.filters.BuybackExecuted();
    const events = await treasury.queryFilter(filter, currentBlock - 1000);

    console.log(`Found ${events.length} BuybackExecuted events.`);
    if (events.length > 0) {
        const last = events[events.length - 1];
        console.log("Last Event:", {
            block: last.blockNumber,
            amountIn: hre.ethers.formatEther(last.args[0]),
            amountOut: hre.ethers.formatEther(last.args[1])
        });
    } else {
        console.log("⚠️ No Buyback events found! It implies executeBuyback failing or not called.");
    }
}

main().catch(console.error);
