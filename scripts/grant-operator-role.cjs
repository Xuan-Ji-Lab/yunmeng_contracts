const hre = require('hardhat');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const coreAddr = '0x92502A20e052A964960329235bb069c383083F27';
    const seekerAddr = '0xebad426ef62412064D944878819564dD2d55da42';

    const core = await hre.ethers.getContractAt('CloudDreamCore', coreAddr, deployer);

    // Check/Grant OPERATOR_ROLE
    const OPERATOR_ROLE = await core.OPERATOR_ROLE();
    console.log('OPERATOR_ROLE:', OPERATOR_ROLE);

    const hasRole = await core.hasRole(OPERATOR_ROLE, seekerAddr);
    console.log('Seeker has OPERATOR_ROLE:', hasRole);

    if (!hasRole) {
        console.log('Granting OPERATOR_ROLE to Seeker...');
        const tx = await core.grantRole(OPERATOR_ROLE, seekerAddr);
        await tx.wait();
        console.log('✅ OPERATOR_ROLE granted to Seeker');
    }
}

main().catch(console.error);
