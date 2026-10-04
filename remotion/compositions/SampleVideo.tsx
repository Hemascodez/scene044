import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  linearTiming,
  TransitionSeries,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { COLORS } from "../config";
import { AnimatedText } from "../components/AnimatedText";
import { AnimatedShape } from "../components/AnimatedShape";
import { Scene } from "../components/Scene";

/**
 * Sample composition demonstrating:
 *  - animated typography (AnimatedText)
 *  - animated graphics (AnimatedShape)
 *  - smooth scene-to-scene transitions (TransitionSeries: fade + slide)
 *
 * This is intentionally built from small, reusable pieces so it's easy for
 * an AI agent (or a human) to copy this file as a template for a new video:
 * duplicate a <TransitionSeries.Sequence>, swap the content, done.
 */

const SCENE_DURATION = 70; // frames per scene, before transition overlap
const TRANSITION_DURATION = 20; // frames each transition takes
const SCENE_COUNT = 3;

/**
 * Total length of this composition in frames. `<TransitionSeries>` overlaps
 * each transition with the scenes on either side of it, so the total is the
 * sum of scene durations minus the overlapping transition frames. Exported
 * so `src/Root.tsx` can size the `<Composition>` correctly without the two
 * files getting out of sync when you add/remove scenes.
 */
export const SAMPLE_VIDEO_DURATION_IN_FRAMES =
  SCENE_COUNT * SCENE_DURATION - (SCENE_COUNT - 1) * TRANSITION_DURATION;

const GradientBackground: React.FC<{ from: string; to: string }> = ({
  from,
  to,
}) => {
  const frame = useCurrentFrame();
  const angle = interpolate(frame, [0, SCENE_DURATION], [0, 25], {
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${135 + angle}deg, ${from}, ${to})`,
      }}
    />
  );
};

export const SampleVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <TransitionSeries>
        {/* Scene 1: Title card */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <Scene>
            <GradientBackground from={COLORS.background} to={COLORS.backgroundAlt} />
            <AnimatedShape
              size={520}
              color={COLORS.primary}
              shape="circle"
              style={{ position: "absolute", opacity: 0.25, right: -120, top: -120 }}
              rotationSpeed={0.1}
            />
            <AnimatedShape
              size={320}
              color={COLORS.accent}
              shape="rounded"
              style={{ position: "absolute", opacity: 0.2, left: -60, bottom: -60 }}
              delay={6}
              rotationSpeed={-0.15}
            />
            <AnimatedText fontSize={120} delay={4}>
              Remotion
            </AnimatedText>
            <AnimatedText
              fontSize={42}
              fontWeight={400}
              color={COLORS.textMuted}
              delay={16}
              style={{ marginTop: 16 }}
            >
              Programmatic motion graphics, made with React
            </AnimatedText>
          </Scene>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 2: Feature / shapes showcase */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <Scene background={COLORS.backgroundAlt}>
            <div
              style={{
                display: "flex",
                gap: 48,
                marginBottom: 64,
              }}
            >
              <AnimatedShape size={140} color={COLORS.primary} shape="circle" delay={0} />
              <AnimatedShape size={140} color={COLORS.accent} shape="rounded" delay={6} />
              <AnimatedShape size={140} color="#FF6B6B" shape="square" delay={12} />
            </div>
            <AnimatedText fontSize={80} delay={10}>
              Animate anything
            </AnimatedText>
            <AnimatedText
              fontSize={36}
              fontWeight={400}
              color={COLORS.textMuted}
              delay={22}
              style={{ marginTop: 12 }}
            >
              Shapes, text, images, audio &mdash; all driven by code
            </AnimatedText>
          </Scene>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Scene 3: Closing card */}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATION}>
          <Scene>
            <GradientBackground from={COLORS.backgroundAlt} to={COLORS.background} />
            <AnimatedShape
              size={420}
              color={COLORS.accent}
              shape="circle"
              style={{ position: "absolute", opacity: 0.18 }}
              rotationSpeed={0.2}
            />
            <AnimatedText fontSize={100} delay={2}>
              Ready to ship ✨
            </AnimatedText>
            <AnimatedText
              fontSize={34}
              fontWeight={400}
              color={COLORS.textMuted}
              delay={14}
              style={{ marginTop: 14 }}
            >
              Edit src/compositions/SampleVideo.tsx to get started
            </AnimatedText>
          </Scene>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
