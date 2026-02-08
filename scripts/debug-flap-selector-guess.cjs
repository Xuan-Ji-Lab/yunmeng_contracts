const hre = require("hardhat");

/**
 * Debug Flap: Selector Guess
 * 尝试调用常见 DEX 和 Bonding Curve 函数签名
 */
async function main() {
    console.log("=".repeat(60));
    console.log("Debug Flap: Selector Guess");

    const FLAP_PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9"; // Portal
    const WISH_TOKEN = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
    const AMOUNT_BNB = hre.ethers.parseEther("0.001");
    const [deployer] = await hre.ethers.getSigners();

    const portal = await hre.ethers.getContractAt([], FLAP_PORTAL);

    // 1. Try Uniswap V2 Router: getAmountsOut
    console.log("\n[Attempt 1] Uniswap V2: getAmountsOut...");
    try {
        const path = [WBNB, WISH_TOKEN];
        const iface = new hre.ethers.Interface(["function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)"]);
        const data = iface.encodeFunctionData("getAmountsOut", [AMOUNT_BNB, path]);

        const result = await hre.ethers.provider.call({ to: FLAP_PORTAL, data });
        const decoded = iface.decodeFunctionResult("getAmountsOut", result);
        console.log("✅ Success (V2)! Amounts:", decoded);
    } catch (e) {
        console.log("❌ Failed (V2):", e.shortMessage || "Reverted");
    }

    // 2. Try Bonding Curve: buyETH
    console.log("\n[Attempt 2] Bonding Curve: buyETH(uint256 minAmountOut, uint256 deadline)...");
    try {
        const iface = new hre.ethers.Interface(["function buyETH(uint256 minAmountOut, uint256 deadline) payable"]);
        // Simulation
        const data = iface.encodeFunctionData("buyETH", [0, Math.floor(Date.now() / 1000) + 3600]);
        await hre.ethers.provider.call({ to: FLAP_PORTAL, data, value: AMOUNT_BNB });
        console.log("✅ Simulation Success (buyETH)!"); // Does not detect success well with call, need staticCall or check revert
    } catch (e) {
        // console.log("❌ Failed (buyETH):", e.shortMessage || "Reverted");
        // Provider call usually throws on revert
        // If message is "0x", it likely failed.
        if (e.data === "0x") console.log("❌ Failed (buyETH): Reverted 0x");
        else console.log("❌ Failed (buyETH):", e.shortMessage);
    }

    // 3. Try Bonding Curve: buy
    console.log("\n[Attempt 3] Bonding Curve: buy(uint256 amountOutMin)...");
    try {
        const iface = new hre.ethers.Interface(["function buy(uint256 amountOutMin) payable"]);
        const data = iface.encodeFunctionData("buy", [0]);
        await hre.ethers.provider.call({ to: FLAP_PORTAL, data, value: AMOUNT_BNB });
        console.log("✅ Simulation Success (buy)!");
    } catch (e) {
        if (e.data === "0x") console.log("❌ Failed (buy): Reverted 0x");
        else console.log("❌ Failed (buy):", e.shortMessage);
    }

    // 4. Try Flap Specific: swapETHForToken
    console.log("\n[Attempt 4] Flap: swapETHForToken(address token, uint256 minAmountOut, address to, uint256 deadline)...");
    try {
        const iface = new hre.ethers.Interface(["function swapETHForToken(address token, uint256 minAmountOut, address to, uint256 deadline) payable"]);
        const data = iface.encodeFunctionData("swapETHForToken", [WISH_TOKEN, 0, deployer.address, Math.floor(Date.now() / 1000) + 3600]);
        await hre.ethers.provider.call({ to: FLAP_PORTAL, data, value: AMOUNT_BNB });
        console.log("✅ Simulation Success (swapETHForToken)!");
    } catch (e) {
        if (e.data === "0x") console.log("❌ Failed (swapETHForToken): Reverted 0x");
        else console.log("❌ Failed (swapETHForToken):", e.shortMessage);
    }

    console.log("=".repeat(60));
}

main().catch(console.error);
