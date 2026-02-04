const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Operating with account:", deployer.address);

    // Load Deployment Info
    const deploymentPath = path.resolve(__dirname, '../../ethereal-realm/src/deployment-info.json');
    if (!fs.existsSync(deploymentPath)) {
        console.error("Deployment info not found at:", deploymentPath);
        return;
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    // Config
    const WISH_ADDRESS = deploymentInfo.wishToken;
    const ROUTER_ADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // PancakeSwap V2 Router (BSC Testnet)

    // Amount to add
    // Adding 10,000 WISH and 0.01 BNB (Adjust as needed)
    // This sets the initial price.
    const WISH_AMOUNT = hre.ethers.parseEther("10000");
    const BNB_AMOUNT = hre.ethers.parseEther("0.01");

    // 1. Get WISH Contract
    const WishToken = await hre.ethers.getContractAt("WishPowerToken", WISH_ADDRESS, deployer);

    // 2. Approve Router
    console.log(`Approving Router to spend ${hre.ethers.formatEther(WISH_AMOUNT)} WISH...`);
    const approveTx = await WishToken.approve(ROUTER_ADDRESS, WISH_AMOUNT);
    await approveTx.wait();
    console.log("✅ Approved.");

    // 3. Add Liquidity
    const Router = await hre.ethers.getContractAt("IPancakeRouter02", ROUTER_ADDRESS, deployer);

    console.log("Adding Liquidity...");
    console.log(`- WISH: ${hre.ethers.formatEther(WISH_AMOUNT)}`);
    console.log(`- BNB: ${hre.ethers.formatEther(BNB_AMOUNT)}`);

    const tx = await Router.addLiquidityETH(
        WISH_ADDRESS,
        WISH_AMOUNT,
        0, // Slippage 0 for testnet
        0, // Slippage 0 for testnet
        deployer.address, // LP tokens go to deployer
        Math.floor(Date.now() / 1000) + 600, // 10 mins deadline
        { value: BNB_AMOUNT }
    );

    console.log("Liquidity Add Tx:", tx.hash);
    await tx.wait();
    console.log("✅ Liquidity Added Successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
