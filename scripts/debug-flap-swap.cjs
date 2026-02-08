const hre = require("hardhat");

/**
 * Debug Flap Swap (Simulation)
 * 既然 Quote 失败，尝试直接模拟 Swap (staticCall)
 * 
 * 运行: npx hardhat run scripts/debug-flap-swap.cjs --network bscTestnet
 */
async function main() {
    console.log("=".repeat(60));
    console.log("Debug Flap Swap (Simulation)");

    const FLAP_PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9"; // Portal (Token Owner)
    const WISH_TOKEN = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const AMOUNT_BNB = hre.ethers.parseEther("0.001");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Caller:", deployer.address);

    // Minimal ABI for Swap
    const abi = [
        "function swapExactInput(tuple(address inputToken, uint256 amountIn, address outputToken, uint256 minAmountOut, address recipient, uint256 deadline, bytes permitData) params) external payable returns (uint256 amountOut)"
    ];

    const portal = await hre.ethers.getContractAt(abi, FLAP_PORTAL);

    const params = {
        inputToken: hre.ethers.ZeroAddress, // BNB
        amountIn: AMOUNT_BNB,
        outputToken: WISH_TOKEN,
        minAmountOut: 0, // No slippage protection for debug
        recipient: deployer.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        permitData: "0x"
    };

    console.log("\nSimulating SwapExactInput...");
    try {
        // 使用 staticCall 模拟交易，如果不 revert 则说明逻辑通畅
        const amountOut = await portal.swapExactInput.staticCall(params, { value: AMOUNT_BNB });
        console.log("✅ Swap 模拟成功!");
        console.log(`- 输入: ${hre.ethers.formatEther(AMOUNT_BNB)} BNB`);
        console.log(`- 输出: ${hre.ethers.formatEther(amountOut)} WISH`);
    } catch (e) {
        console.error("❌ Swap 模拟失败:");
        console.error("  Message:", e.message);
        if (e.data) console.error("  Data:", e.data);
    }
    console.log("=".repeat(60));
}

main().catch(console.error);
