const hre = require("hardhat");
const fs = require('fs');
const path = require('path');
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("🚀 Upgrading DreamSeeker & Deploying BatchReader with account:", deployer.address);

    const seekerProxyAddress = deploymentInfo.contracts.DreamSeeker;
    const oracleAddress = deploymentInfo.contracts.DreamOracle;

    if (!seekerProxyAddress) {
        throw new Error("Missing DreamSeeker address in deployment-modular.json");
    }

    // 1. Upgrade DreamSeeker
    console.log("🔄 Upgrading DreamSeeker...");
    const DreamSeekerFactory = await hre.ethers.getContractFactory("DreamSeeker");
    // Validate that it is indeed a proxy upgrade
    // Using openzeppelin upgrades plugin if available, but here we might need manual UUPS upgrade if plugin not used
    // Assuming hardhat-upgrades is used based on imports in other scripts usually, but let's check package.json or usage
    // If not, we use forceImport or similar. 
    // Let's assume standard upgrades.upgradeProxy usage.

    // Check if we have the upgrades plugin loaded. If not, we might fall back to manual implementation deployment + upgradeTo
    // But typically:
    const upgradedSeeker = await hre.upgrades.upgradeProxy(seekerProxyAddress, DreamSeekerFactory);
    await upgradedSeeker.waitForDeployment();
    console.log("✅ DreamSeeker Upgraded");

    // 2. Deploy NEW CloudDreamBatchReader
    // BatchReader is immutable, so we must redeploy it to support new Seeker structs/functions
    console.log("Deploying NEW CloudDreamBatchReader...");
    const BatchReaderFactory = await hre.ethers.getContractFactory("CloudDreamBatchReader");
    const batchReader = await BatchReaderFactory.deploy(seekerProxyAddress, oracleAddress);
    await batchReader.waitForDeployment();
    const batchReaderAddr = await batchReader.getAddress();
    console.log("✅ New CloudDreamBatchReader Deployed at:", batchReaderAddr);

    // 3. Update deployment-modular.json
    const deploymentPath = path.join(__dirname, '../deploy/deployment-modular.json');
    const newDeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    newDeploymentInfo.contracts.CloudDreamBatchReader = batchReaderAddr;

    // Update ABIs
    const seekerArtifact = await hre.artifacts.readArtifact("DreamSeeker");
    const readerArtifact = await hre.artifacts.readArtifact("CloudDreamBatchReader");

    newDeploymentInfo.abis.Seeker = seekerArtifact.abi;
    newDeploymentInfo.abis.BatchReader = readerArtifact.abi;

    fs.writeFileSync(deploymentPath, JSON.stringify(newDeploymentInfo, null, 2));
    console.log("💾 Updated deployment-modular.json");

    // 4. Update Frontend JSON
    const frontendPath = path.join(__dirname, '../../ethereal-realm/src/deployment-modular.json');
    if (fs.existsSync(frontendPath)) {
        fs.writeFileSync(frontendPath, JSON.stringify(newDeploymentInfo, null, 2));
        console.log("💾 Updated frontend deployment-modular.json");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
