const hre = require("hardhat");
const fs = require('fs');
const path = require('path');
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("🚀 Deploying CloudDreamBatchReader with account:", deployer.address);

    const seekerAddr = deploymentInfo.contracts.DreamSeeker;
    const oracleAddr = deploymentInfo.contracts.DreamOracle;

    if (!seekerAddr || !oracleAddr) {
        throw new Error("Missing DreamSeeker or DreamOracle address in deployment-modular.json");
    }

    console.log("📍 Seeker:", seekerAddr);
    console.log("📍 Oracle:", oracleAddr);

    const BatchReaderFactory = await hre.ethers.getContractFactory("CloudDreamBatchReader");
    const batchReader = await BatchReaderFactory.deploy(seekerAddr, oracleAddr);

    await batchReader.waitForDeployment();
    const batchReaderAddr = await batchReader.getAddress();
    console.log("✅ CloudDreamBatchReader Deployed at:", batchReaderAddr);

    // Update deployment-modular.json
    const deploymentPath = path.join(__dirname, '../deploy/deployment-modular.json');
    const newDeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    newDeploymentInfo.contracts.CloudDreamBatchReader = batchReaderAddr;

    // Add ABI if missing? Usually we want full ABI.
    // But for now just contract address is enough for web3.tsx to init if it has ABI locally or in JSON.
    // web3.tsx uses `deploymentInfo.abis.BatchReader`.
    // I need to add ABI to JSON too!

    const artifact = await hre.artifacts.readArtifact("CloudDreamBatchReader");
    newDeploymentInfo.abis = newDeploymentInfo.abis || {};
    newDeploymentInfo.abis.BatchReader = artifact.abi;

    fs.writeFileSync(deploymentPath, JSON.stringify(newDeploymentInfo, null, 2));
    console.log("💾 Updated deployment-modular.json");

    // Also update frontend Copy if it exists?
    // The user has `ethereal-realm/src/deployment-modular.json`.
    // I should update that one too if I can.
    // But better to let user copy or I update it myself.
    // I will try to update `../ethereal-realm/src/deployment-modular.json` as well.

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
