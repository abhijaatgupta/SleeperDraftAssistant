import { describe, expect, it } from "vitest";
import { readDraftPagePickOwnership } from "../../src/content/draft-page-ownership";

describe("readDraftPagePickOwnership", () => {
  it("extracts acquired and traded-away mock draft picks from Sleeper cells", () => {
    document.body.innerHTML = `
      <div class="cell false" id="draft-cell-11">
        <div class="pick">2.1</div>
        <div class="pick-traded own">abhijaat</div>
      </div>
      <div class="cell false" id="draft-cell-18">
        <div class="pick">2.8</div>
        <div class="keeper-icon"><i class="fa fa-lock"></i></div>
        <div class="pick-traded">another manager</div>
      </div>
      <div class="cell false" id="draft-cell-30">
        <div class="pick">3.10</div>
        <div class="pick-traded own">abhijaat</div>
      </div>
      <div class="cell false" id="draft-cell-43"><div class="pick">5.3</div></div>
    `;

    expect(readDraftPagePickOwnership(document)).toEqual({
      ownedPickNumbers: [11, 30],
      tradedPickNumbers: [18],
      keeperPickNumbers: [18],
    });
  });

  it("returns null before the draft board has rendered", () => {
    document.body.innerHTML = "<main>Loading</main>";
    expect(readDraftPagePickOwnership(document)).toBeNull();
  });
});
