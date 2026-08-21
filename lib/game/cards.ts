import type { CardDefinition } from "./types";

export const CHANCE_DECK: CardDefinition[] = [
  { id: "chance-advance-go", deck: "chance", text: "Advance to GO. Collect $200.", effect: { kind: "move_to_position", position: 0, collectGoIfPassed: false } },
  { id: "chance-dividend", deck: "chance", text: "Your portfolio pays an unexpected dividend of $150.", effect: { kind: "collect", amount: 150 } },
  { id: "chance-audit-fine", deck: "chance", text: "You're fined $100 for a late filing.", effect: { kind: "pay", amount: 100 } },
  { id: "chance-go-to-jail", deck: "chance", text: "Regulators are asking questions. Go directly to Jail.", effect: { kind: "go_to_jail" } },
  { id: "chance-jail-free", deck: "chance", text: "Get out of Jail Free — keep this card until needed.", effect: { kind: "get_out_of_jail_free" } },
  { id: "chance-move-back", deck: "chance", text: "Market correction — move back 3 spaces.", effect: { kind: "move_relative", steps: -3 } },
  { id: "chance-windfall", deck: "chance", text: "A startup you backed gets acquired. Collect $250.", effect: { kind: "collect", amount: 250 } },
  { id: "chance-legal-fees", deck: "chance", text: "Pay legal fees of $75 to each other player.", effect: { kind: "pay_each_player", amount: 75 } },
  { id: "chance-repairs", deck: "chance", text: "Building inspection: pay $40 per house/hotel level you own.", effect: { kind: "repairs", perLevel: 40 } },
  { id: "chance-move-forward", deck: "chance", text: "Insider tip — advance 5 spaces.", effect: { kind: "move_relative", steps: 5 } },
];

export const COMMUNITY_DECK: CardDefinition[] = [
  { id: "community-tax-refund", deck: "community", text: "Tax refund. Collect $100.", effect: { kind: "collect", amount: 100 } },
  { id: "community-fine", deck: "community", text: "Community fine for noise complaints — pay $50.", effect: { kind: "pay", amount: 50 } },
  { id: "community-birthday", deck: "community", text: "It's your birthday — collect $20 from each player.", effect: { kind: "collect_from_each_player", amount: 20 } },
  { id: "community-jail-free", deck: "community", text: "Get out of Jail Free — keep this card until needed.", effect: { kind: "get_out_of_jail_free" } },
  { id: "community-go-to-jail", deck: "community", text: "Caught in a compliance sweep. Go directly to Jail.", effect: { kind: "go_to_jail" } },
  { id: "community-grant", deck: "community", text: "Small business grant awarded. Collect $75.", effect: { kind: "collect", amount: 75 } },
  { id: "community-donation", deck: "community", text: "Charity drive — pay $60.", effect: { kind: "pay", amount: 60 } },
  { id: "community-repairs", deck: "community", text: "Neighborhood upkeep: pay $25 per house/hotel level you own.", effect: { kind: "repairs", perLevel: 25 } },
  { id: "community-advance-go", deck: "community", text: "Advance to GO. Collect $200.", effect: { kind: "move_to_position", position: 0, collectGoIfPassed: false } },
];
