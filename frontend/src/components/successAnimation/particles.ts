export type SuccessMode = "create" | "update";

export type SuccessParticle = {
  id:string;
  x:number;
  y:number;
  rotation:number;
  delay:number;
  color:string;
};

const COLORS = ["#ff2d6e", "#ff7a90", "#ffffff", "#ffd166", "#6c63ff"];

const hashSeed = (seed:string) => {
  let hash = 0;

  for(let index = 0; index < seed.length; index += 1){
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) || 1;
};

const createRandom = (seed:string) => {
  let value = hashSeed(seed);

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
};

const createParticle = (
  random:()=>number,
  idPrefix:string,
  index:number,
  spread:number
):SuccessParticle => ({
  id:`${idPrefix}-${index}`,
  x:Math.round((random() - 0.5) * spread),
  y:Math.round(-20 - random() * spread),
  rotation:Math.round((random() - 0.5) * 140),
  delay:Number((random() * 0.22).toFixed(2)),
  color:COLORS[index % COLORS.length]
});

export const createSuccessParticles = (seed:string, mode:SuccessMode) => {
  const random = createRandom(`${seed}-${mode}`);
  const sparkleCount = mode === "create" ? 10 : 2;
  const confettiCount = mode === "create" ? 8 : 0;

  return {
    sparkles:Array.from({length:sparkleCount}, (_, index)=>createParticle(random, "sparkle", index, 160)),
    confetti:Array.from({length:confettiCount}, (_, index)=>createParticle(random, "confetti", index, 210))
  };
};
