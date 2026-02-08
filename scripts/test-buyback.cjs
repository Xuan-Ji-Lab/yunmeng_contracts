const hre = require("hardhat");

/**
 * 手动触发 Treasury 回购测试脚本
 * 
 * 运行: npx hardhat run scripts/test-buyback.cjs --network bscTestnet
 */
async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("=".repeat(60));
    console.log("Treasury 回购功能测试");
    console.log("操作账户:", deployer.address);

    const TREASURY_ADDRESS = "0xf261e933e404427c81fb4e8D936772b113BC03Ea";
    const WISH_TOKEN_ADDRESS = "0x00050c0d05b0f852c44aef369f188764fd417777";

    const treasury = await hre.ethers.getContractAt("DreamTreasury", TREASURY_ADDRESS);
    const wishToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", WISH_TOKEN_ADDRESS);

    // 1. 检查 Treasury 初始状态
    const bnbBalanceBefore = await hre.ethers.provider.getBalance(TREASURY_ADDRESS);
    const wishBalanceBefore = await wishToken.balanceOf(TREASURY_ADDRESS);

    console.log("初始状态:");
    console.log(`- BNB 余额: ${hre.ethers.formatEther(bnbBalanceBefore)} BNB`);
    console.log(`- WISH 余额: ${hre.ethers.formatEther(wishBalanceBefore)} WISH`);

    // 2. 确保 Treasury 有 BNB 用于回购
    // 如果余额过低 (小于 0.001 BNB)，注入一点 BNB
    if (bnbBalanceBefore < hre.ethers.parseEther("0.001")) {
        console.log("\nTreasury BNB 余额不足，正在注入 0.002 BNB...");
        const tx = await deployer.sendTransaction({
            to: TREASURY_ADDRESS,
            value: hre.ethers.parseEther("0.002")
        });
        await tx.wait();
        console.log("注资完成");
    }

    // 3. 触发回购
    console.log("\n执行回购操作 (executeBuyback)...");
    // amountIn = 0 表示使用全部可用余额的一定比例 (取决于合约配置)
    // 或者我们可以指定一个小金额测试，比如 0.001 BNB
    const buybackAmount = hre.ethers.parseEther("0.001");

    try {
        const tx = await treasury.executeBuyback(buybackAmount);
        console.log("交易发送成功:", tx.hash);
        const receipt = await tx.wait();

        // 查找 BuybackExecuted 事件
        const event = receipt.logs.find(log => {
            try {
                const parsed = treasury.interface.parseLog(log);
                return parsed && parsed.name === "BuybackExecuted";
            } catch (e) { return false; }
        });

        if (event) {
            const parsed = treasury.interface.parseLog(event);
            console.log("\n✅ 回购成功!");
            console.log(`- 消耗 BNB: ${hre.ethers.formatEther(parsed.args.bnbAmount)}`);
            console.log(`- 获得 WISH: ${hre.ethers.formatEther(parsed.args.tokensReceived)}`);
        } else {
            console.warn("\n⚠️ 交易成功但未在日志中找到 BuybackExecuted 事件 (可能是金额太小被忽略?)");
        }

    } catch (e) {
        console.error("\n❌ 回购失败:");
        if (e.reason) console.error("Revert Reason:", e.reason);
        else console.error(e.message);
    }

    // 4. 检查最终状态
    const bnbBalanceAfter = await hre.ethers.provider.getBalance(TREASURY_ADDRESS);
    const wishBalanceAfter = await wishToken.balanceOf(TREASURY_ADDRESS);

    console.log("\n最终状态:");
    console.log(`- BNB 余额: ${hre.ethers.formatEther(bnbBalanceAfter)} BNB`);
    console.log(`- WISH 余额: ${hre.ethers.formatEther(wishBalanceAfter)} WISH`);
    console.log("=".repeat(60));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
