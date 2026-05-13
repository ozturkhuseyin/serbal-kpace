import { MissionContract } from '../ui/stores/gameStore';

/**
 * Generates and tracks contracts for career mode. Procedural templates that
 * scale with the player's reputation level.
 */
export class CareerManager {
  private nextId = 1;

  generateContracts(reputation: number, count = 4): MissionContract[] {
    const out: MissionContract[] = [];
    for (let i = 0; i < count; i++) {
      out.push(this.makeContract(reputation));
    }
    return out;
  }

  private makeContract(reputation: number): MissionContract {
    const tier = Math.min(4, Math.floor(reputation / 25));
    const templates = TEMPLATES[tier] ?? TEMPLATES[0];
    const t = templates[Math.floor(Math.random() * templates.length)];
    const id = `contract-${this.nextId++}-${Date.now()}`;
    const scale = 1 + tier * 0.4;
    return {
      id,
      title: t.title,
      description: t.description,
      reward: Math.round(t.baseReward * scale),
      reputation: t.baseReputation,
      science: t.baseScience,
      requirements: t.requirements,
      status: 'available',
    };
  }

  /**
   * Evaluate a contract against the current vessel + telemetry. Returns true
   * if the contract is satisfied.
   */
  isComplete(contract: MissionContract, telemetry: { altitudeASL: number; parentBody: string; situation: string; apoapsis: number }): boolean {
    return contract.requirements.every((req) => evaluateRequirement(req, telemetry));
  }
}

interface ContractTemplate {
  title: string;
  description: string;
  baseReward: number;
  baseReputation: number;
  baseScience: number;
  requirements: string[];
}

const TEMPLATES: ContractTemplate[][] = [
  [
    {
      title: 'First Flight',
      description: 'Reach an altitude of 10 km above Kerbin.',
      baseReward: 6000,
      baseReputation: 4,
      baseScience: 4,
      requirements: ['altitude>=10000', 'body=Kerbin'],
    },
    {
      title: 'Edge of Space',
      description: 'Cross the Karman Line (70 km).',
      baseReward: 12000,
      baseReputation: 6,
      baseScience: 6,
      requirements: ['altitude>=70000', 'body=Kerbin'],
    },
  ],
  [
    {
      title: 'First Orbit',
      description: 'Reach a stable circular orbit around Kerbin.',
      baseReward: 28000,
      baseReputation: 12,
      baseScience: 14,
      requirements: ['apoapsis>=85000', 'body=Kerbin', 'situation=in-space-low'],
    },
  ],
  [
    {
      title: 'Munar Flyby',
      description: 'Enter the Mun\'s sphere of influence.',
      baseReward: 60000,
      baseReputation: 22,
      baseScience: 30,
      requirements: ['body=Mun'],
    },
  ],
  [
    {
      title: 'Duna Mission',
      description: 'Reach Duna\'s SOI.',
      baseReward: 200000,
      baseReputation: 60,
      baseScience: 90,
      requirements: ['body=Duna'],
    },
  ],
];

function evaluateRequirement(req: string, t: { altitudeASL: number; parentBody: string; situation: string; apoapsis: number }): boolean {
  if (req.startsWith('altitude>=')) return t.altitudeASL >= parseFloat(req.slice('altitude>='.length));
  if (req.startsWith('apoapsis>=')) return t.apoapsis >= parseFloat(req.slice('apoapsis>='.length));
  if (req.startsWith('body=')) return t.parentBody.toLowerCase() === req.slice(5).toLowerCase();
  if (req.startsWith('situation=')) return t.situation === req.slice('situation='.length);
  return false;
}
