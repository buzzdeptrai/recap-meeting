import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Segmenter, fakeResult, type RawSegment } from "../src";

function setup() {
  const segments: RawSegment[] = [];
  const segmenter = new Segmenter({ channel: 1, onSegment: (s) => segments.push(s) });
  return { segmenter, segments };
}
const allText = (segments: RawSegment[]) => segments.map((s) => s.text).join(" ");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const EIGHTEEN =
  "we identified top three competitors for every single stage and then we tiered them all in the sheet";

describe("cut position survives a revised hypothesis (meeting 78c6ccfc)", () => {
  it("does not repeat a word when earlier words were merged by the final", () => {
    const { segmenter, segments } = setup();
    const spelled =
      "we identified top three competitors for A D O Atlassian and then we tiered them all in the sheet";
    segmenter.onInterim(fakeResult(1, spelled, 0, 6000));
    expect(segments).toHaveLength(1);
    const merged = spelled.replace("A D O", "ADO");
    segmenter.onFinal(fakeResult(1, `${merged} right now today folks.`, 0, 8000));
    vi.advanceTimersByTime(3000);
    expect(segments.map((s) => s.text)).toEqual([spelled, "right now today folks."]);
  });

  it("does not lose a word when the final split one earlier word in two", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(1, EIGHTEEN, 0, 6000));
    const cut = segments[0]?.text ?? "";
    segmenter.onFinal(
      fakeResult(1, `${EIGHTEEN.replace("three", "3 x")} Jenkins and CloudBees here.`, 0, 8000),
    );
    vi.advanceTimersByTime(3000);
    expect(cut.split(" ")).toHaveLength(18);
    expect(segments.slice(1).map((s) => s.text)).toEqual(["Jenkins and CloudBees here."]);
  });

  it("emits each word once when the hypothesis grows between cuts", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(1, EIGHTEEN, 0, 6000));
    segmenter.onInterim(fakeResult(1, `${EIGHTEEN} then Tier one only.`, 0, 7000));
    segmenter.onFinal(fakeResult(1, `${EIGHTEEN} then Tier one only.`, 0, 7000));
    vi.advanceTimersByTime(3000);
    expect(allText(segments)).toBe(`${EIGHTEEN} then Tier one only.`);
  });

  it("keeps the first words of a new turn when the previous turn never got a final", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(1, EIGHTEEN, 0, 6000));
    const nextTurn = "So this this where we are right now is tier one competitors only.";
    segmenter.onFinal(fakeResult(1, nextTurn, 9000, 14_000));
    vi.advanceTimersByTime(3000);
    expect(segments.at(-1)?.text.startsWith("So this this where")).toBe(true);
    expect(allText(segments)).toBe(`${EIGHTEEN} ${nextTurn}`);
  });
});

describe("words repeated by the vendor at a turn join", () => {
  it("drops a single repeated word", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(
      fakeResult(1, "which I think we already identified a while back.", 106_000, 110_242),
    );
    segmenter.onFinal(
      fakeResult(
        1,
        "back. I think we identified top 3 competitors for every stage.",
        110_458,
        114_052,
      ),
    );
    vi.advanceTimersByTime(3000);
    expect(segments.map((s) => s.text)).toEqual([
      "which I think we already identified a while back.",
      "I think we identified top 3 competitors for every stage.",
    ]);
  });

  it("drops a repeated phrase whose times overlap", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(
      fakeResult(
        1,
        "each sheet has ADO, Atlassian, GitHub, Jenkins, JFrog, and CloudBees.",
        93_466,
        99_562,
      ),
    );
    segmenter.onFinal(
      fakeResult(1, "Jenkins, JFrog, and CloudBees, right? Only some apply here.", 98_159, 102_000),
    );
    vi.advanceTimersByTime(3000);
    expect(segments[1]?.text).toBe("right? Only some apply here.");
  });

  it("keeps a genuine repetition that comes later", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(1, "we shipped it a while back.", 0, 3000));
    segmenter.onFinal(fakeResult(1, "back. Then we moved on to the plan.", 6000, 9000));
    vi.advanceTimersByTime(3000);
    expect(segments[1]?.text).toBe("back. Then we moved on to the plan.");
  });
});

describe("short syllable repeated at a turn join (Vietnamese)", () => {
  const FIRST = "tôi đã hẹn gặp bác sĩ";
  const SECOND = "vâng ạ";

  function join(secondStartMs: number, secondFirst: string, first = FIRST) {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(1, first, 0, 5000));
    segmenter.onFinal(
      fakeResult(1, `${secondFirst} ${SECOND}`, secondStartMs, secondStartMs + 1500),
    );
    vi.advanceTimersByTime(3000);
    return segments.map((s) => s.text);
  }

  it("drops a 2-letter syllable that restarts exactly where the last one ended", () => {
    expect(join(5000, "sĩ")).toEqual([FIRST, SECOND]);
  });

  it("keeps the same syllable when it is spoken again after a pause", () => {
    expect(join(5300, "sĩ")).toEqual([FIRST, `sĩ ${SECOND}`]);
  });

  it("never drops a repeated interjection (vâng vâng, no no, dạ dạ)", () => {
    // the segmenter may merge both results into one segment; the repeated word must survive
    const text = (word: string, first: string) => join(5000, word, first).join(" ");
    expect(text("vâng", "chị nói đúng rồi vâng")).toBe(`chị nói đúng rồi vâng vâng ${SECOND}`);
    expect(text("no", "I said no no")).toBe(`I said no no no ${SECOND}`);
    expect(text("dạ", "em hiểu rồi dạ")).toBe(`em hiểu rồi dạ dạ ${SECOND}`);
  });
});

describe("timeline and fragments", () => {
  it("never starts a segment before the previous one ended, without dropping words", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(1, "getting it reviewed from the PM team now.", 17_667, 20_175));
    segmenter.onFinal(
      fakeResult(1, "My guess was that we would not share competitors.", 19_232, 24_980),
    );
    vi.advanceTimersByTime(3000);
    expect(segments).toHaveLength(2);
    expect(segments[1]?.startMs).toBeGreaterThanOrEqual(segments[0]?.endMs ?? 0);
    expect(segments[1]?.endMs).toBeGreaterThanOrEqual(segments[1]?.startMs ?? 0);
  });

  it("does not cut after a preposition that the vendor closed with a full stop", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(1, "so that is what I wanted to check with.", 71_195, 73_355));
    vi.advanceTimersByTime(400);
    expect(segments).toHaveLength(0);
    segmenter.onInterim(
      fakeResult(1, "so that is what I wanted to check with you.", 71_195, 73_900),
    );
    vi.advanceTimersByTime(300);
    expect(segments.map((s) => s.text)).toEqual(["so that is what I wanted to check with you."]);
  });

  it("holds a one-second sentence fragment and joins it with the next result", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(1, "we have to do it.", 268_129, 268_965));
    expect(segments).toHaveLength(0);
    segmenter.onFinal(fakeResult(1, "I do not think we can wait for them.", 269_000, 271_000));
    expect(segments.map((s) => s.text)).toEqual([
      "we have to do it. I do not think we can wait for them.",
    ]);
  });

  it("still emits a held fragment on its own after the hold time", () => {
    const { segmenter, segments } = setup();
    segmenter.onFinal(fakeResult(1, "we have to do it.", 0, 900));
    vi.advanceTimersByTime(1500);
    expect(segments).toMatchObject([{ text: "we have to do it.", reason: "buffer_flush" }]);
  });
});

describe("STT reconnect: the old turn's tail is not lost (sister-project 3-19 word loss)", () => {
  // The old socket died mid-turn without a final; the new socket starts a fresh turn later.
  const TAIL = "so then we"; // below minWords: no cut and no silence timer is armed for it
  const NEW_TURN = "Okay the next topic is the budget for the second quarter.";

  it("emits the unfinished tail exactly once when a new connection's turn arrives", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(1, TAIL, 0, 1500));
    expect(segments).toHaveLength(0);
    segmenter.onInterim(fakeResult(1, "Okay the next", 9000, 9600));
    segmenter.onFinal(fakeResult(1, NEW_TURN, 9000, 13_000));
    vi.advanceTimersByTime(3000);
    const texts = segments.map((s) => s.text);
    expect(texts.filter((t) => t === TAIL)).toHaveLength(1);
    expect(texts.at(-1)).toBe(NEW_TURN);
    expect(allText(segments)).toBe(`${TAIL} ${NEW_TURN}`);
  });

  it("emits a partly cut old turn's remaining words once, and clears the cursor", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(1, EIGHTEEN, 0, 6000));
    segmenter.onInterim(fakeResult(1, `${EIGHTEEN} and also`, 0, 6500));
    expect(segments).toHaveLength(1); // the 18 words were cut; "and also" is pending
    segmenter.onFinal(fakeResult(1, NEW_TURN, 9000, 13_000));
    vi.advanceTimersByTime(3000);
    expect(allText(segments)).toBe(`${EIGHTEEN} and also ${NEW_TURN}`);
  });

  it("does not flush on a revised hypothesis of the same turn", () => {
    const { segmenter, segments } = setup();
    segmenter.onInterim(fakeResult(1, TAIL, 0, 1500));
    segmenter.onInterim(fakeResult(1, `${TAIL} go`, 40, 1800));
    expect(segments).toHaveLength(0);
  });
});
