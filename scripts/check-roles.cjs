const hre = require('hardhat');

async function main() {
    const coreAddr = '0x92502A20e052A964960329235bb069c383083F27';
    const seekerAddr = '0xebad426ef62412064D944878819564dD2d55da42';

    const core = await hre.ethers.getContractAt('CloudDreamCore', coreAddr);

    // Check roles
    const OPERATOR_ROLE = await core.OPERATOR_ROLE();
    const MODULE_CALLER_ROLE = await core.MODULE_CALLER_ROLE();

    console.log('Seeker has OPERATOR_ROLE:', await core.hasRole(OPERATOR_ROLE, seekerAddr));
    console.log('Seeker has MODULE_CALLER_ROLE:', await core.hasRole(MODULE_CALLER_ROLE, seekerAddr));
}

main().catch(console.error);
