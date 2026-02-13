const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("正在将归墟概率调整为 100% ...");

    const network = hre.network.name;
    const deployInfoPath = `deploy/deployment-modular.json`; // 默认部署文件路径

    // 加载部署信息
    let deployInfo;
    if (fs.existsSync(`deploy/deployment-${network}.json`)) {
        deployInfo = JSON.parse(fs.readFileSync(`deploy/deployment-${network}.json`));
    } else if (fs.existsSync(deployInfoPath)) {
        deployInfo = JSON.parse(fs.readFileSync(deployInfoPath));
    } else {
        throw new Error("未找到部署信息文件");
    }

    const seekerAddr = deployInfo.contracts.DreamSeeker;
    const seeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddr);
    const [deployer] = await hre.ethers.getSigners();

    console.log("DreamSeeker 合约地址:", seekerAddr);
    console.log("部署者地址:", deployer.address);

    // 获取当前概率阈值
    try {
        const currentThresholds = [];
        for (let i = 0; i < 4; i++) {
            currentThresholds.push(await seeker.tierThresholds(i));
        }
        console.log("当前阈值:", currentThresholds.map(t => t.toString()));
    } catch (e) {
        console.log("无法读取当前阈值:", e.message);
    }

    // 检查并授予 CONFIG_ROLE 权限
    const coreAddr = deployInfo.contracts.CloudDreamCore;
    const core = await hre.ethers.getContractAt("ICloudDreamCore", coreAddr);
    const CONFIG_ROLE = await core.CONFIG_ROLE();

    if (!await core.hasRole(CONFIG_ROLE, deployer.address)) {
        console.log("正在授予部署者 CONFIG_ROLE 权限...");
        const DEFAULT_ADMIN = await core.DEFAULT_ADMIN_ROLE();
        if (await core.hasRole(DEFAULT_ADMIN, deployer.address)) {
            await (await core.grantRole(CONFIG_ROLE, deployer.address)).wait();
            console.log("已授予 CONFIG_ROLE 权限");
        } else {
            console.error("部署者缺少 DEFAULT_ADMIN_ROLE，无法授予 CONFIG_ROLE。");
            return;
        }
    }

    // 设置所有阈值为 [1000, 1000, 1000, 1000]
    // Tier 0 (归墟) 判定条件: random % 1000 < threshold[0]
    // 如果 threshold[0] = 1000，则 0-999 都小于 1000，即 100% 触发归墟。
    // const newThresholds = [1000, 1000, 1000, 1000];
    //  [1, 11, 41, 141]
    const newThresholds = [1, 11, 41, 141];


    console.log("正在设置新阈值:", newThresholds);
    const tx = await seeker.setTierThresholds(newThresholds);
    await tx.wait();

    console.log("✅ 阈值更新成功！归墟概率现已调整为 100%。");

    // 验证更新结果
    try {
        const updatedThresholds = [];
        for (let i = 0; i < 4; i++) {
            updatedThresholds.push(await seeker.tierThresholds(i));
        }
        console.log("验证新阈值:", updatedThresholds.map(t => t.toString()));
    } catch (e) {
        console.log("验证读取失败:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
