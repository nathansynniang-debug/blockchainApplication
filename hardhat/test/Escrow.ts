import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

describe("Escrow reverse auction (TypeScript)", function () {
  async function deployFixture() {
    const [owner, driver, s1, s2, s3] = await ethers.getSigners();
    const token = await ethers.deployContract("EVCToken");
    const escrow = await ethers.deployContract("Escrow", [await token.getAddress()]);
    for (const s of [s1, s2, s3]) await escrow.registerStation(s.address);
    await token.transfer(driver.address, ethers.parseEther("500"));
    return { token, escrow, owner, driver, s1, s2, s3 };
  }

  it("picks the cheapest station and pays it", async function () {
    const { token, escrow, driver, s1, s2, s3 } = await networkHelpers.loadFixture(deployFixture);
    const stations = [s1.address, s2.address, s3.address];
    const rates = [ethers.parseEther("0.5"), ethers.parseEther("0.3"), ethers.parseEther("0.4")];

    await expect(escrow.connect(driver).reverseAuction(stations, rates, 20n))
      .to.emit(escrow, "AuctionWon")
      .withArgs(1n, driver.address, s2.address, rates[1], 20n, rates[1] * 20n);

    const cost = rates[1] * 20n;
    await token.connect(driver).approve(await escrow.getAddress(), cost);
    await expect(escrow.connect(driver).payAuction(1n)).to.emit(escrow, "AuctionPaid");
    expect(await token.balanceOf(s2.address)).to.equal(cost);
  });

  it("rejects stations that are not registered", async function () {
    const { escrow, driver, s1 } = await networkHelpers.loadFixture(deployFixture);
    const [, , , , , rogue] = await ethers.getSigners();
    await expect(
      escrow.connect(driver).reverseAuction([s1.address, rogue.address], [1n, 1n], 5n),
    ).to.be.revertedWithCustomError(escrow, "NotStation");
  });
});
