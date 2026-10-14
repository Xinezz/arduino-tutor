// The reward flow: ONE place that turns "something just got earned" into the
// whole game-feel response - floating +XP/+coin numbers, the right fanfare,
// the HUD ticking up, level-up banners, the milestone chest, rank promotions,
// achievement and mission toasts.
//
// It doesn't change progress itself and doesn't know about any screen.
// app.js takes a snapshot() before calling a progress.js earn function, then
// hands that snapshot back to settle() afterward; settle() diffs the two to
// work out what happened (a level crossed? a rank gained? a trophy earned?),
// kicks off the presentation, and returns a summary so app.js can also have
// Sam react in the right tone. Replacing four copy-pasted before/after blocks
// in app.js with this is the whole point.

import { getLevelInfo, unlockAchievements, LEVEL_MILESTONES } from "../progress/progress.js";
import { computeCurrentRankIndex, RANKS } from "../progress/ranks.js";
import { evaluateAchievements } from "./achievements.js";
import { completedMissionIds, getDailyBoard, pendingRewardCount } from "./missions.js";
import { playSfx } from "./audio.js";
import { floatText, bump } from "./fx.js";
import { icon } from "./sprites.js";
import { showToast } from "./toast.js";
import { levelUpFanfare, openChest, openPromotion, achievementToast, missionToast } from "./cinematics.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const FANFARE = {
  lesson: "lessonComplete",
  challenge: "challengeComplete",
  quiz: "correct",
  stage: "lessonComplete",
};

export function createRewardFlow({ getProgress, hud }) {
  function snapshot() {
    const p = getProgress();
    return {
      xp: p.xp,
      level: getLevelInfo(p.xp).level,
      credits: p.credits,
      milestones: p.milestonesAwarded.length,
      rank: computeCurrentRankIndex(p),
      missions: new Set(completedMissionIds(p)),
    };
  }

  // Records any newly-earned trophies (paying their credits) and returns the
  // definitions. Presentation is separate, so callers can order it.
  function unlockNew() {
    const p = getProgress();
    const fresh = evaluateAchievements(p);
    if (fresh.length) unlockAchievements(p, fresh.map(({ id, reward }) => ({ id, reward })));
    return fresh;
  }

  async function announceAchievements(defs, delay = 0) {
    if (!defs.length) return;
    if (delay) await wait(delay);
    // A save from before trophies existed can earn a whole pile at once -
    // one summary toast beats a dozen in a row.
    if (defs.length > 3) {
      const total = defs.reduce((n, d) => n + (d.reward || 0), 0);
      playSfx("achievement");
      showToast({
        iconHtml: icon("trophy", 3),
        title: `${defs.length} ACHIEVEMENTS UNLOCKED`,
        text: `+${total} credits — open your Profile to see the trophy room`,
        kind: "achievement",
        duration: 7000,
      });
      return;
    }
    for (const def of defs) {
      achievementToast(def);
      await wait(900);
    }
  }

  // Cheap re-check for things that aren't a "finished work" event: a program
  // run, a hint used, a purchase, a secret.
  function checkAchievements({ delay = 350 } = {}) {
    const fresh = unlockNew();
    const p = getProgress();
    hud.update(p);
    hud.setProfileBadge(pendingRewardCount(p));
    announceAchievements(fresh, delay);
    return fresh;
  }

  function settle(before, { kind = "lesson", at = null } = {}) {
    const p = getProgress();
    const gained = p.xp - before.xp;
    const after = snapshot();
    const result = { gained, levelUp: null, rankUp: null, achievements: [], missions: [] };

    if (p.milestonesAwarded.length > before.milestones) {
      const level = p.milestonesAwarded[p.milestonesAwarded.length - 1];
      result.levelUp = { level, isMilestone: true, bonus: LEVEL_MILESTONES[level] };
    } else if (after.level > before.level) {
      result.levelUp = { level: after.level, isMilestone: false, bonus: null };
    }
    if (after.rank > before.rank) {
      result.rankUp = { from: RANKS[before.rank], to: RANKS[after.rank] };
    }
    const nowDone = [...after.missions].filter((id) => !before.missions.has(id));
    result.missions = getDailyBoard(p).missions.filter((m) => nowDone.includes(m.id));
    result.achievements = unlockNew();

    // The milestone bonus is in the balance already, but the chest is about to
    // "reveal" it - keep it off the readout until then.
    if (result.levelUp?.isMilestone) hud.holdCoins(result.levelUp.bonus);
    hud.update(p);
    hud.setProfileBadge(pendingRewardCount(p));

    present(result, { kind, at }).catch((err) => console.error("reward presentation failed", err));
    return result;
  }

  async function present(result, { kind, at }) {
    const point = at ?? hud.els.coins;

    if (result.gained > 0) {
      playSfx(FANFARE[kind] ?? "correct");
      floatText(point, `+${result.gained} XP`, { kind: "xp", dx: -54 });
      floatText(point, `${icon("coin", 2)} +${result.gained}`, { kind: "coin", dx: 54 });
    }

    if (result.levelUp) {
      await wait(650);
      levelUpFanfare(result.levelUp);
      bump(hud.els.level);
      if (result.levelUp.isMilestone) {
        await wait(2300);
        await openChest({
          title: `LEVEL ${result.levelUp.level} BONUS!`,
          subtitle: "CircuitWorks pays out a bonus at every big milestone.",
          reward: result.levelUp.bonus,
        });
        hud.releaseCoins();
      }
    }

    if (result.rankUp) {
      await wait(result.levelUp ? 400 : 900);
      await openPromotion({ rank: result.rankUp.to, previousRank: result.rankUp.from });
    }

    for (const m of result.missions) {
      missionToast(m);
      await wait(900);
    }
    await announceAchievements(result.achievements, result.levelUp || result.rankUp ? 300 : 600);
  }

  // Credits going out (a hint, the solution). The sound is played by the
  // button that was clicked, so this is just the number and the HUD.
  function spent(amount, at = null) {
    const p = getProgress();
    floatText(at ?? hud.els.coins, `${icon("coin", 2)} -${amount}`, { kind: "spend" });
    hud.update(p);
    checkAchievements();
  }

  return { snapshot, settle, spent, checkAchievements, announceAchievements, unlockNew };
}
