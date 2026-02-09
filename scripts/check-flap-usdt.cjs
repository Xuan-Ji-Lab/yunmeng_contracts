const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const deploymentPath = path.join(__dirname, "../deploy/deployment-modular.json");
    if (!fs.existsSync(deploymentPath)) {
        console.error("❌ Deployment file not found");
        return;
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const wishTokenAddress = deploymentInfo.contracts.WishPowerToken;

    console.log(`Using WISH Token: ${wishTokenAddress}`);

    const FLAP_PORTAL_ADDRESS = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9";
    const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"; // BSC Testnet USDT
    // Also try BUSD just in case
    const BUSD_ADDRESS = "0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee";

    const flapInterface = [
        "function quoteExactInput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)"
    ];

    const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
    const flapContract = new ethers.Contract(FLAP_PORTAL_ADDRESS, flapInterface, provider);

    const amountIn = ethers.parseEther("1"); // 1 WISH

    console.log(`\nTesting WISH -> USDT (${USDT_ADDRESS})...`);
    try {
        const usdtOut = await flapContract.quoteExactInput(wishTokenAddress, USDT_ADDRESS, amountIn);
        console.log(`✅ 1 WISH = ${ethers.formatUnits(usdtOut, 18)} USDT`); // Assuming 18 decimals for testnet USDT
    } catch (e) {
        console.log(`❌ WISH -> USDT failed or no liquidity: ${e.message}`);
    }

    console.log(`\nTesting WISH -> BUSD (${BUSD_ADDRESS})...`);
    try {
        const busdOut = await flapContract.quoteExactInput(wishTokenAddress, BUSD_ADDRESS, amountIn);
        console.log(`✅ 1 WISH = ${ethers.formatUnits(busdOut, 18)} BUSD`);
    } catch (e) {
        console.log(`❌ WISH -> BUSD failed or no liquidity: ${e.message}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
