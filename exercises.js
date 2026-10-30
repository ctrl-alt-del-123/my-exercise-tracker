/*
  Foot Rehab: the exercise program
  ================================
  This is the only file to edit when you add or change exercises.
  The app reads window.PROGRAM when it opens.

  To add an exercise:
    1. Add an entry to `exercises` below. Copying a similar one is the easiest start.
    2. Put its id in a stage's `exercises` list, or add it to `extras`
       so it can be switched on in Settings.
    3. Publish the change. The phone picks it up the next time the app opens online.

  Exercise fields
    name, goal        Title and one-line purpose.
    sets              Sets per foot (default 1). `setWord` renames "Set", e.g. "Round".
    reps              Reps per set (default 1). `repsRange: [min, max]` adds a +/- control.
    hold              Seconds for any phase whose `secs` is "hold".
                      `holdRange: [min, max]` adds a +/- control (`holdStep` sets the step).
    perFoot           false when both feet work together (default true).
    setup             Key in `setups` that overrides the stage's starting position.
    rest              Seconds of rest between sets (default: the Settings value).
    dose              Optional list of chips that replaces the automatic dose summary.
    steps, cue, check, mistakes, note
                      Text for the instruction screen.
    picture           Drawing on the instruction screen: { toes, arrow, ball }.
                        toes:  five numbers, big toe first. 0 resting, 1 lifted, 2 pressing.
                        arrow: "short" (arch draw) or "spread".
                        ball:  true draws a ball under the arch.
    rep               The timed phases of one rep, in order.
    parts             Instead of `rep`: a list of { name, intro, rep } blocks that run
                      one after another (toe yoga uses this for its two positions).

  Phase fields
    kind              "effort" (coral), "relax" (green) or "prep" (grey).
    label             The big word on the timer screen.
    secs              Seconds, or "hold" to use the exercise's hold time.
    text              The instruction under the timer.
    say, sayFirst     Spoken cue (defaults to label). `sayFirst` replaces it on the first rep.
    toes, arrow, ball Drawing during this phase, same format as `picture`.
*/
(function () {
  "use strict";

  var REST = [0, 0, 0, 0, 0];
  var TOE_NAMES = ["big toe", "second toe", "middle toe", "fourth toe", "little toe"];

  // One round of the toe lift sequence: lift big toe to little toe, then lower little toe to big toe.
  function toeLiftRound() {
    var out = [];
    for (var i = 0; i < 5; i++) {
      var up = [0, 0, 0, 0, 0];
      for (var j = 0; j <= i; j++) up[j] = 1;
      out.push({
        kind: "effort",
        label: "Lift " + TOE_NAMES[i],
        secs: 4,
        toes: up,
        text: i === 0
          ? "Lift the big toe. If it will not move, guide it up with a finger."
          : "Keep the lifted toes up and add the " + TOE_NAMES[i] + ". Guide it with a finger if needed.",
        say: "Lift the " + TOE_NAMES[i]
      });
    }
    for (var k = 4; k >= 0; k--) {
      var down = [0, 0, 0, 0, 0];
      for (var m = 0; m < k; m++) down[m] = 1;
      out.push({
        kind: "relax",
        label: "Lower " + TOE_NAMES[k],
        secs: 4,
        toes: down,
        text: "Lower the " + TOE_NAMES[k] + " slowly to the floor.",
        say: "Lower the " + TOE_NAMES[k]
      });
    }
    return out;
  }

  window.PROGRAM = {
    name: "Foot Rehab",
    subtitle: "Intrinsic foot exercise program",
    weeklyTarget: 5,
    restBetweenSets: 20,
    // Optional: office: { name: "Clinic name", phone: "555-555-5555" } adds a tap-to-call number.
    // It is left out here because this file is published on a public web address.
    afterSession: "Your plan lists the lacrosse ball after these exercises.",

    setups: {
      seated: "Sit tall on a chair with your knee over your ankle. Bare foot flat on the floor, toes long and relaxed, hands resting on your thighs.",
      standing: "Stand at a counter with your fingertips resting lightly on it. Let your other foot rest beside this one for balance. Spread your weight evenly across the working foot.",
      singleLeg: "Stand on the working foot with a light fingertip touch on the counter. Keep the knee softly bent.",
      counterBoth: "Stand at a counter with both hands resting lightly on it, feet hip-width apart."
    },

    // The six-week progression from the handout.
    stages: [
      {
        id: "seated", label: "Weeks 1-2", name: "Seated", short: "Seated", weeks: [1, 2], setup: "seated",
        exercises: ["short-foot", "toe-yoga", "toe-spread", "big-toe-press", "toe-lift"],
        advance: "Move on when you can isolate each movement without curling your toes or rolling your ankle."
      },
      {
        id: "standing", label: "Weeks 3-4", name: "Standing with support", short: "Standing", weeks: [3, 4], setup: "standing",
        exercises: ["short-foot", "toe-yoga", "toe-spread", "big-toe-press"],
        advance: "Move on when you can hold the arch for 10 seconds without pain or cramping."
      },
      {
        id: "balance", label: "Weeks 5-6", name: "Single-leg balance", short: "Balance", weeks: [5, 6], setup: "singleLeg",
        exercises: ["short-foot-balance"],
        advance: "Your follow-up comes before this stage. Ask your doctor whether single-leg work and heel raises are cleared."
      }
    ],

    // Optional add-ons, switched on in Settings. They run after the stage's exercises.
    extras: [
      { id: "heel-raise", label: "Supported heel raise", hint: "Only after your doctor approves it. Handout: 3 days a week.", default: false },
      { id: "lacrosse-ball", label: "Lacrosse ball roll", hint: "Runs at the end of the session. You set the time.", default: false }
    ],

    exercises: {
      "short-foot": {
        name: "Short foot (arch lift)",
        goal: "Wakes up the deep muscles that hold your arch.",
        sets: 2, reps: 8, repsRange: [8, 10], hold: 5,
        picture: { toes: REST, arrow: "short" },
        steps: [
          "Find the tripod: heel, base of the big toe, base of the little toe. All three touch the floor.",
          "Without curling your toes, slide the ball of your foot (the pad behind the big toe) back toward your heel. The foot gets shorter.",
          "Your arch rises a little. Heel and toes stay on the floor.",
          "Hold 5 seconds, then relax fully before the next rep."
        ],
        cue: "The foot gets shorter, not narrower. Keep the heel down.",
        check: "Rest two fingers on top of your arch. You should feel it bulge upward as the foot shortens. Afterward, wiggle your toes. If they feel cramped, you were gripping.",
        mistakes: [
          "Curling or gripping the toes. They should stay flat and long.",
          "Lifting the heel or the toes off the floor.",
          "Squeezing hard. Aim for gentle effort, about a third of your maximum.",
          "Holding your breath. Breathe out as you draw the foot short."
        ],
        rep: [
          { kind: "effort", label: "Draw", secs: 2, arrow: "short", text: "Slide the ball of your foot back toward your heel. Toes stay long and soft.", sayFirst: "Draw the foot short." },
          { kind: "effort", label: "Hold", secs: "hold", arrow: "short", text: "Keep the arch lifted. Heel down, toes relaxed. Breathe normally.", sayFirst: "Hold. Arch up, toes soft." },
          { kind: "relax", label: "Relax", secs: 3, text: "Let the arch settle completely." }
        ]
      },

      "toe-yoga": {
        name: "Toe yoga",
        goal: "Teaches each toe to move on its own.",
        sets: 2, reps: 8,
        picture: { toes: [1, 0, 0, 0, 0] },
        steps: [
          "Keep the heel and the ball of the foot grounded.",
          "Position A: lift only the big toe. The four smaller toes stay on the floor. Hold briefly, then lower.",
          "Position B: press the big toe down and lift only the four smaller toes. Hold briefly, then lower.",
          "Do all 8 reps of A, then all 8 reps of B. That is one set."
        ],
        cue: "Move only the toes. Keep the ankle still.",
        check: "Watch your ankle bone. It should not rock. Do not let the foot roll outward to fake the lift.",
        mistakes: [
          "Rolling the foot outward or rocking the ankle to get a toe up.",
          "Lifting the small toes along with the big toe in Position A.",
          "Curling the toes that should stay down.",
          "Forcing it. If a toe will not lift, relax and try again with less effort. A finger can help it up at first."
        ],
        note: "The timing (3 seconds up, 2 seconds down) is set by this app. Your handout gives reps, not timing.",
        parts: [
          {
            name: "Position A: big toe up",
            rep: [
              { kind: "effort", label: "Lift", secs: 3, toes: [1, 0, 0, 0, 0], text: "Lift only the big toe. The four smaller toes stay down. Ankle still.", sayFirst: "Lift only the big toe." },
              { kind: "relax", label: "Lower", secs: 2, text: "Lower slowly and let the toes rest." }
            ]
          },
          {
            name: "Position B: big toe down, small toes up",
            intro: { kind: "prep", label: "Switch", secs: 5, text: "Position B: press the big toe down and lift only the four smaller toes.", say: "Switch. Big toe down, lift the small toes." },
            rep: [
              { kind: "effort", label: "Lift", secs: 3, toes: [2, 1, 1, 1, 1], text: "Big toe presses down. Lift only the four smaller toes.", sayFirst: "Lift the four small toes." },
              { kind: "relax", label: "Lower", secs: 2, text: "Lower slowly and let the toes rest." }
            ]
          }
        ]
      },

      "toe-spread": {
        name: "Toe spread",
        goal: "Strengthens the muscles that separate your toes.",
        sets: 2, reps: 10, hold: 3,
        picture: { toes: REST, arrow: "spread" },
        steps: [
          "Place the foot flat and relax the toes.",
          "Fan the toes apart, like opening a hand, without lifting or curling them.",
          "Hold 3 seconds, then release.",
          "Start with a small movement. A little gap is enough."
        ],
        cue: "Start with a small movement. Avoid clawing.",
        check: "Look down. Small gaps should open between the toes while they stay flat. If they barely move at first, keep picturing the spread and try again.",
        mistakes: [
          "Clawing: toes bending down and gripping the floor.",
          "Lifting the toes off the floor to spread them.",
          "Pushing so hard the foot cramps. Ease off and shake it out.",
          "Rolling the foot onto its outer edge."
        ],
        rep: [
          { kind: "effort", label: "Spread", secs: "hold", arrow: "spread", text: "Fan the toes apart gently. Keep them flat on the floor.", sayFirst: "Spread the toes, keep them flat." },
          { kind: "relax", label: "Release", secs: 2, text: "Let the toes come back together." }
        ]
      },

      "big-toe-press": {
        name: "Big toe press",
        goal: "Improves push-off and arch control.",
        sets: 2, reps: 10, hold: 5,
        picture: { toes: [2, 0, 0, 0, 0] },
        steps: [
          "Set the tripod: heel, base of the big toe, base of the little toe. All three stay grounded.",
          "Gently press the pad of the big toe straight down into the floor, like pressing a light switch. About a third of your effort.",
          "Keep the other four toes long and relaxed. They do not curl or lift.",
          "Keep the arch up. Do not let the ankle roll inward. Hold 5 seconds, then release."
        ],
        cue: "Pressure under the big toe should not collapse the arch.",
        check: "Look at the inside of your ankle and arch while you press. They should stay where they were, not drop inward. A mirror or a short phone video helps.",
        mistakes: [
          "The arch collapsing or the ankle rolling inward as you press.",
          "Small toes curling or lifting.",
          "Pressing hard. Think gentle, steady pressure.",
          "Lifting the heel or the little-toe side of the foot.",
          "Holding your breath."
        ],
        rep: [
          { kind: "effort", label: "Press", secs: "hold", toes: [2, 0, 0, 0, 0], text: "Press the big toe down gently. Arch stays up, other toes relaxed.", sayFirst: "Press the big toe down. Arch up." },
          { kind: "relax", label: "Release", secs: 3, text: "Let go completely. Toes soft." }
        ]
      },

      "toe-lift": {
        name: "Toe lift sequence",
        goal: "Builds coordination across all five toes.",
        sets: 2, setWord: "Round", reps: 1, rest: 5,
        dose: ["2 slow rounds"],
        picture: { toes: [1, 1, 0, 0, 0] },
        steps: [
          "Begin with all five toes resting on the floor.",
          "Lift one toe at a time if you can, starting with the big toe and working toward the little toe.",
          "Then lower them one at a time, from the little toe back to the big toe.",
          "If you cannot lift the toes one by one, lift the big toe separately from the smaller toes. Use your fingers to guide a toe at first."
        ],
        cue: "Use your fingers to guide a toe at first if needed.",
        check: "Moving the middle toes separately is hard at first. Guide each toe up with a finger, and over the weeks the movement becomes your own.",
        mistakes: [
          "Rushing. Go slowly and watch each toe.",
          "Curling the toes that are meant to stay down.",
          "Rolling the ankle to get the toes up.",
          "Holding your breath."
        ],
        note: "Your handout says to lift one toe at a time, then lower one at a time. This app lifts big toe to little toe, then lowers little toe back to big toe. Ask at your follow-up if your doctor wants a different order.",
        rep: toeLiftRound()
      },

      "short-foot-balance": {
        name: "Short-foot balance",
        goal: "Keeps your arch steady while you balance on one leg.",
        sets: 3, setWord: "Round", reps: 1, hold: 20, holdRange: [20, 30], holdStep: 5,
        holdHint: "Handout: 20 to 30 seconds.",
        setup: "singleLeg",
        picture: { toes: REST, arrow: "short" },
        steps: [
          "Stand on the working foot with a light fingertip touch on the counter.",
          "Find the tripod, then gently do the short-foot movement: ball of the foot toward the heel.",
          "Lift the other foot just off the floor.",
          "Keep the big-toe base pressed down and stay steady for the full time."
        ],
        cue: "Stay steady and keep the big-toe base grounded.",
        check: "If the arch flattens or the toes grip, put the other foot down, reset the tripod, and start the round again.",
        mistakes: [
          "Gripping with the toes.",
          "Locking the knee. Keep it softly bent.",
          "Letting the arch collapse as you tire.",
          "Holding your breath."
        ],
        note: "Slow heel raises are only for when your doctor approves them. Ask at your follow-up.",
        rep: [
          { kind: "prep", label: "Short foot", secs: 4, arrow: "short", text: "Draw the foot short, then lift the other foot just off the floor.", say: "Short foot, then lift the other foot." },
          { kind: "effort", label: "Balance", secs: "hold", arrow: "short", text: "Big-toe base grounded. Arch up. Toes soft. Breathe." },
          { kind: "relax", label: "Foot down", secs: 3, text: "Put the other foot down and shake out." }
        ]
      },

      "heel-raise": {
        name: "Supported heel raise",
        goal: "Builds push-off strength while the tripod stays in control.",
        perFoot: false, setup: "counterBoth",
        sets: 2, reps: 8, repsRange: [8, 12],
        picture: { toes: REST },
        steps: [
          "Stand at a counter with both hands resting lightly on it, feet hip-width apart.",
          "Set the tripod on both feet: heel, big-toe base, little-toe base.",
          "Rise slowly onto the balls of your feet. Keep pressure over the big-toe base so the feet do not roll outward.",
          "Lower slowly for 3 seconds. Start with both legs."
        ],
        cue: "Rise straight up over the big-toe base. Do not roll outward.",
        check: "Watch your ankles as you rise. They should travel straight up, not tip toward the little toes.",
        mistakes: [
          "Rolling onto the outer edge of the foot.",
          "Dropping down fast. Lower for a slow count of 3.",
          "Gripping with the toes.",
          "Pulling yourself up with your hands. The counter is for balance only."
        ],
        note: "Handout: 2 sets of 8 to 12, 3 days a week, and only if your clinician approves it.",
        rep: [
          { kind: "effort", label: "Rise", secs: 2, text: "Rise slowly onto the balls of your feet. Pressure over the big-toe base.", sayFirst: "Rise slowly." },
          { kind: "effort", label: "Lower", secs: 3, text: "Lower slowly to the floor.", sayFirst: "Lower slowly." },
          { kind: "relax", label: "Reset", secs: 2, text: "Heels down. Reset the tripod." }
        ]
      },

      "lacrosse-ball": {
        name: "Lacrosse ball roll",
        goal: "Eases the bottom of the foot after the exercises.",
        setup: "seated",
        sets: 1, reps: 1, hold: 60, holdRange: [30, 120], holdStep: 15, holdLabel: "roll",
        holdHint: "Your plan doesn't give a time. Ask your clinician.",
        picture: { ball: true },
        steps: [
          "Sit with the ball under the arch of your foot.",
          "Roll slowly from the heel to the ball of the foot and back.",
          "Use gentle pressure. Let the weight of your leg do the work.",
          "Ease off if anything feels sharp."
        ],
        cue: "Gentle pressure, slow rolls. Ease off any sharp pain.",
        check: "The pressure should feel like a firm massage, not pain.",
        mistakes: [
          "Pressing so hard it hurts.",
          "Rolling fast.",
          "Standing on the ball with your full body weight."
        ],
        rep: [
          { kind: "effort", label: "Roll", secs: "hold", ball: true, text: "Roll slowly from the heel to the ball of the foot and back. Gentle pressure.", sayFirst: "Roll slowly, gentle pressure." }
        ]
      }
    }
  };
})();
