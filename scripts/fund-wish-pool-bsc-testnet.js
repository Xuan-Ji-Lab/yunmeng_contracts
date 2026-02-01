
const hre = require("hardhat");
const deploymentInfo = require("../../ethereal-realm/src/deployment-info.json");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Funding pool with account:", deployer.address);

    // Contract Addresses from frontend deployment-info or recent deployment
    const protocolAddress = deploymentInfo.address;
    // We need to fetch the Token address from the contract or deployment info
    // Since deployment-info usually only has the main contract, let's instantiate it to find the token

    const CloudDreamProtocol = await hre.ethers.getContractFactory("CloudDreamProtocol");
    const protocol = CloudDreamProtocol.attach(protocolAddress);

    const wishTokenAddress = await protocol.wishToken();
    console.log("Wish Token Address:", wishTokenAddress);
    console.log("Protocol Address:", protocolAddress);

    const WishPowerToken = await hre.ethers.getContractFactory("WishPowerToken"); // Assuming artifact name
    const wishToken = await WishPowerToken.attach(wishTokenAddress);

    // 1. Approve Protocol to spend tokens
    // Fund 100 Million WISH
    const fundAmount = hre.ethers.parseEther("100000000");

    console.log("Approving protocol to spend 100M WISH...");
    const approveTx = await wishToken.approve(protocolAddress, fundAmount);
    await approveTx.wait();
    console.log("Approved.");

    // 2. Deposit
    console.log("Depositing 100M WISH to prize pool...");
    const depositTx = await protocol.depositRewardTokens(fundAmount);
    await depositTx.wait();

    console.log("✅ Successfully deposited 100,000,000 WISH into the pool!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
