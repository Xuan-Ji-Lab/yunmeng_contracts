const hre = require('hardhat');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const coreAddr = '0x92502A20e052A964960329235bb069c383083F27';

    const core = await hre.ethers.getContractAt('CloudDreamCore', coreAddr, deployer);

    const OPERATOR_ROLE = await core.OPERATOR_ROLE();

    console.log('Granting OPERATOR_ROLE to deployer:', deployer.address);
    const tx = await core.grantRole(OPERATOR_ROLE, deployer.address);
    await tx.wait();
    console.log('✅ Done');

    // Now try buyback
    const treasuryAddr = '0x2620CD6C5Ce76a9bffdf91fbB8542654BDd7096c';
    const treasury = await hre.ethers.getContractAt('DreamTreasury', treasuryAddr, deployer);

    const bal = await hre.ethers.provider.getBalance(treasuryAddr);
    console.log('Treasury BNB:', hre.ethers.formatEther(bal));

    console.log('Executing buyback...');
    const tx2 = await treasury.executeBuyback(0);
    await tx2.wait();
    console.log('✅ Buyback done');

    // Check WISH balance
    const wishToken = await treasury.wishToken();
    const IERC20 = ['function balanceOf(address) view returns (uint256)'];
    const token = new hre.ethers.Contract(wishToken, IERC20, deployer);
    const wishBal = await token.balanceOf(treasuryAddr);
    console.log('Treasury WISH:', hre.ethers.formatEther(wishBal));
}

main().catch(console.error);
