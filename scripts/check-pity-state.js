const hre = require("hardhat"); // Using hre for ethers provider

async function main() {
    const deploymentInfo = require("../../ethereal-realm/src/deployment-info.json");
    const contractAddress = deploymentInfo.address;
    const userAddress = "0xB7Ac35615C4B82b430B98fAdC91e257980A21d77"; // From screenshot/deployer

    console.log(`Checking Pity State for User: ${userAddress}`);
    console.log(`Contract: ${contractAddress}`);

    const CloudDreamProtocol = await hre.ethers.getContractFactory("CloudDreamProtocol");
    const contract = CloudDreamProtocol.attach(contractAddress);

    // 1. Check Tribulation Count
    const tribCount = await contract.userTribulationCount(userAddress);
    console.log(`User Tribulation Count: ${tribCount.toString()}`);

    // 2. Check Tribulation Weight
    const tribWeight = await contract.userTribulationWeight(userAddress);
    console.log(`User Tribulation Weight: ${tribWeight.toString()}`);

    // 3. Check Wish Token Pool
    const pool = await contract.wishTokenPool();
    console.log(`Global Wish Token Pool: ${hre.ethers.formatEther(pool)} WISH`);

    // 4. Check Pity Base Unit
    const pityBase = await contract.PITY_BASE_UNIT();
    console.log(`Pity Base Unit: ${hre.ethers.formatEther(pityBase)} WISH`);

    // 5. Calculate Expected Pity
    const expectedPity = BigInt(tribWeight) * BigInt(pityBase);
    console.log(`Potential Pity Reward: ${hre.ethers.formatEther(expectedPity)} WISH`);

    // 6. Check Token Balance of Contract
    const wishTokenAddr = await contract.wishToken();
    const wishToken = await hre.ethers.getContractAt("IERC20Minimal", wishTokenAddr);
    const balance = await wishToken.balanceOf(contractAddress);
    console.log(`Contract WISH Balance: ${hre.ethers.formatEther(balance)} WISH`);

    // 7. Check if Balance >= Pity
    if (balance < expectedPity) {
        console.warn("WARNING: Contract Balance is LESS than Expected Pity! Transfer might fail, but Event should still emit with 0 reward.");
    } else {
        console.log("Contract has sufficient balance for pity.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
