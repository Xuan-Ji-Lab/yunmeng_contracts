const hre = require("hardhat");

/**
 * Debug Flap Quote
 * 直接调用 Flap Portal 询价，不经过 Treasury
 * 
 * 运行: npx hardhat run scripts/debug-flap-quote.cjs --network bscTestnet
 */
async function main() {
    console.log("=".repeat(60));
    console.log("Debug Flap 询价 (Quote)");

    const FLAP_PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9";
    const WISH_TOKEN = "0x00050c0d05b0f852c44aef369f188764fd417777";
    const INPUT_BNB = hre.ethers.parseEther("0.001"); // 0.001 BNB

    console.log(`- Portal: ${FLAP_PORTAL}`);
    console.log(`- Token: ${WISH_TOKEN}`);
    console.log(`- AmountIn: ${hre.ethers.formatEther(INPUT_BNB)} BNB`);

    // 最小化 ABI，只包含 quoteExactInput
    const abi = [
        "function quoteExactInput(tuple(address inputToken, uint256 amountIn, address outputToken) params) external view returns (uint256 amountOut)"
    ];

    const WBNB_TESTNET = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

    const portal = await hre.ethers.getContractAt(abi, FLAP_PORTAL);

    // 0. 检查 Portal 是否存在
    const code = await hre.ethers.provider.getCode(FLAP_PORTAL);
    if (code === "0x") {
        console.error("❌ Portal 地址无代码! 请检查网络或地址。");
        return;
    }

    // 1. 尝试使用 address(0) (Native BNB)
    console.log("\n[Attempt 1] 使用 Native BNB (address(0))...");
    try {
        const params = {
            inputToken: hre.ethers.ZeroAddress,
            amountIn: INPUT_BNB,
            outputToken: WISH_TOKEN
        };
        const amountOut = await portal.quoteExactInput(params);
        console.log("✅ 询价成功!");
        console.log(`- 预期输出: ${hre.ethers.formatEther(amountOut)} WISH`);
        return;
    } catch (e) {
        console.log("❌ 失败:", e.shortMessage || e.message);
    }

    // 2. 尝试使用 WBNB
    console.log("\n[Attempt 2] 使用 WBNB...");
    try {
        const params = {
            inputToken: WBNB_TESTNET,
            amountIn: INPUT_BNB,
            outputToken: WISH_TOKEN
        };
        const amountOut = await portal.quoteExactInput(params);
        console.log("✅ 询价成功!");
        console.log(`- 预期输出: ${hre.ethers.formatEther(amountOut)} WISH`);
    } catch (e) {
        console.log("❌ 失败:", e.shortMessage || e.message);
    }
    console.log("=".repeat(60));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
