/**
 * 提高 VRF Callback Gas Limit (归墟路径需要更多 gas)
 * 
 * 用法: npx hardhat run scripts/increase-vrf-gas.js --network bscTestnet
 */
const hre = require("hardhat");
const d = require('../deploy/deployment-modular.json');

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("🔧 Using account:", signer.address);

    const core = await hre.ethers.getContractAt("CloudDreamCore", d.contracts.CloudDreamCore);

    // 读取当前配置
    const keyHash = await core.vrfKeyHash();
    const subId = await core.vrfSubscriptionId();
    const oldGasLimit = await core.vrfCallbackGasLimit();
    const confirmations = await core.vrfRequestConfirmations();

    console.log("\n📊 当前配置:");
    console.log("  Gas Limit:", oldGasLimit.toString());

    // 提高到 2500000 (归墟路径涉及代币铸造、分红等复杂逻辑)
    const newGasLimit = 2500000;
    console.log("\n⚙️  提升 Gas Limit:", oldGasLimit.toString(), "→", newGasLimit);

    const tx = await core.setVRFConfig(keyHash, subId, newGasLimit, confirmations);
    console.log("  交易哈希:", tx.hash);
    await tx.wait();

    console.log("✅ 设置成功！新 Gas Limit:", newGasLimit);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
