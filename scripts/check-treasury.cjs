const hre = require('hardhat');

async function main() {
    const treasuryAddr = '0x2620CD6C5Ce76a9bffdf91fbB8542654BDd7096c';
    const treasury = await hre.ethers.getContractAt('DreamTreasury', treasuryAddr);

    console.log('Treasury Config:');
    console.log('  buybackEnabled:', await treasury.buybackEnabled());
    console.log('  buybackPercent:', (await treasury.buybackPercent()).toString());
    console.log('  wishToken:', await treasury.wishToken());
    console.log('  flapPortal:', await treasury.flapPortal());

    const bal = await hre.ethers.provider.getBalance(treasuryAddr);
    console.log('  BNB Balance:', hre.ethers.formatEther(bal));
}

main().catch(console.error);
