const hre = require("hardhat");
const fs = require("fs");

/**
 * 将指定地址添加到 CloudDreamCore 合约的 OPERATOR_ROLE 角色中
 * 用于授权测试地址或运维脚本执行特定操作
 */
async function main() {
    // 读取部署配置
    const deploymentPath = "deploy/deployment-modular.json";
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const coreAddr = deployment.contracts.CloudDreamCore;

    // 要添加的测试地址列表
    const testAddresses = [
        "0x7463F2618e362a8D957f319E8d8374b3ad307242",
        "0xB7Ac35615C4B82b430B98fAdC91e257980A21d77",
        "0x332a1e2b704811556Ec642CE204ED659327A0c46"
    ];

    console.log("=".repeat(60));
    console.log("批量添加 OPERATOR 角色");
    console.log("=".repeat(60));
    console.log("CloudDreamCore 合约地址:", coreAddr);
    console.log("待授权地址数量:", testAddresses.length);
    testAddresses.forEach((addr, idx) => {
        console.log(`  ${idx + 1}. ${addr}`);
    });
    console.log();

    // 获取合约实例
    const core = await hre.ethers.getContractAt("CloudDreamCore", coreAddr);

    // 获取 OPERATOR_ROLE 的角色标识符
    const operatorRole = await core.OPERATOR_ROLE();
    console.log("OPERATOR_ROLE 标识符:", operatorRole);
    console.log();

    // 逐个处理每个地址
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (let i = 0; i < testAddresses.length; i++) {
        const address = testAddresses[i];
        console.log(`[${i + 1}/${testAddresses.length}] 处理地址: ${address}`);

        // 检查地址是否已经拥有该角色
        const hasRole = await core.hasRole(operatorRole, address);
        console.log(`  当前是否已有权限: ${hasRole}`);

        if (hasRole) {
            console.log(`  ⏭️  该地址已经拥有 OPERATOR_ROLE,跳过`);
            skipCount++;
        } else {
            try {
                // 授予角色
                console.log(`  正在授予 OPERATOR_ROLE...`);
                const tx = await core.grantRole(operatorRole, address);
                console.log(`  交易哈希: ${tx.hash}`);

                // 等待交易确认
                const receipt = await tx.wait();
                console.log(`  交易已确认,区块号: ${receipt.blockNumber}`);

                // 验证授权是否成功
                const hasRoleAfter = await core.hasRole(operatorRole, address);
                if (hasRoleAfter) {
                    console.log(`  ✅ 授权成功!`);
                    successCount++;
                } else {
                    console.log(`  ❌ 授权失败,验证未通过`);
                    failCount++;
                }
            } catch (error) {
                console.log(`  ❌ 授权出错: ${error.message}`);
                failCount++;
            }
        }
        console.log();
    }

    // 打印汇总信息
    console.log("=".repeat(60));
    console.log("执行完成!");
    console.log(`✅ 成功: ${successCount} 个`);
    console.log(`⏭️  跳过: ${skipCount} 个 (已有权限)`);
    console.log(`❌ 失败: ${failCount} 个`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ 执行出错:");
        console.error(error);
        process.exit(1);
    });
