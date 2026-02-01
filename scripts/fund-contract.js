
const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Funding contract with account:", deployer.address);

    // Read Protocol Address from deployment-info.json
    const path = require('path');
    const fs = require('fs');
    const deploymentPath = path.resolve(__dirname, '../../ethereal-realm/src/deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    const PROTOCOL_ADDRESS = deploymentInfo.address;
    const WISH_TOKEN_ADDRESS = deploymentInfo.wishToken;

    console.log(`Target Protocol: ${PROTOCOL_ADDRESS}`);
    console.log(`Token Address: ${WISH_TOKEN_ADDRESS}`);

    // Connect to Token
    const tokenAbi = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)"
    ];
    const token = await ethers.getContractAt(tokenAbi, WISH_TOKEN_ADDRESS, deployer);

    // Connect to Protocol
    const protocolAbi = [
        "function depositRewardTokens(uint256 amount) external"
    ];
    const protocol = await ethers.getContractAt(protocolAbi, PROTOCOL_ADDRESS, deployer);

    // Amount to fund: 1,000,000 WISH
    const FUND_AMOUNT = ethers.parseEther("1000000");

    console.log("Checking deployer balance...");
    const balance = await token.balanceOf(deployer.address);
    console.log(`Deployer Balance: ${ethers.formatEther(balance)} WISH`);

    if (balance < FUND_AMOUNT) {
        console.error("Insufficient balance to fund contract!");
        // Proceed with whatever we have? No, let's try 100,000
        // return;
    }

    console.log(`Approving ${ethers.formatEther(FUND_AMOUNT)} WISH to Protocol...`);
    const txApprove = await token.approve(PROTOCOL_ADDRESS, FUND_AMOUNT);
    await txApprove.wait();
    console.log("Approve Confirmed.");

    console.log(`Depositing ${ethers.formatEther(FUND_AMOUNT)} WISH via depositRewardTokens...`);
    const txDeposit = await protocol.depositRewardTokens(FUND_AMOUNT, { gasLimit: 500000 });
    await txDeposit.wait();

    console.log("✅ Deposit Confirmed! Contract funded.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
