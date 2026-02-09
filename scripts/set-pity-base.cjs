const hre = require('hardhat');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const seeker = await hre.ethers.getContractAt('DreamSeeker', '0xebad426ef62412064D944878819564dD2d55da42', deployer);

    console.log("Setting pityBase to 0.0005 BNB via setSeekConfig...");
    // setSeekConfig(seekCost, karmaCost, pityBase, pityThreshold)
    const tx = await seeker.setSeekConfig(
        hre.ethers.parseEther('0.005'),  // seekCost
        10,                               // karmaCost
        hre.ethers.parseEther('0.0005'), // pityBase
        9                                 // pityThreshold
    );
    await tx.wait();
    console.log('✅ pityBase updated to 0.0005 BNB');
}

main().catch(console.error);
