// Static content: the neighbour name/role/stake pools and the trait table.
// Ported verbatim from the production game so generated casts match.

import type { Trait } from '@core/types';

export const NAMES = ['Rosa','Tomás','Marta','Luis','Carmen','Diego','Ana','Pablo','Lucía','Miguel','Elena','Javier','Sofía','Andrés','Valeria','Hugo','Camila','Rafael','Inés','Óscar','Paula','Emilio','Clara','Bruno','Alma','Simón','Nadia','Félix','Irene','Mateo'];

export const ROLES = ['a nurse','a bus driver','a teacher','a baker','a student','a mechanic','a shopkeeper','a farmer','a musician','a carpenter','an electrician','a seamstress','a doctor','a waiter','a fisherman','a librarian','a barber','a street vendor','a welder','a cook','a painter','a pharmacist','a janitor','a taxi driver'];

export const STAKES = ['the clinic lost its funding last winter','their brother was taken years ago','the pension stopped coming','their daughter wants to leave the country','the shop was fined for nothing','they lost their job for asking questions','their street floods and no one comes','the school has no books this year','their rent doubled overnight','they saw something they were not supposed to see'];

export const TRAITS: Trait[] = [
  { id: 'talker', hint: 'listens best over coffee', talkMul: 1.6 },
  { id: 'gatherer', hint: 'comes alive in meetings', talkMul: 1.0 },
  { id: 'artist', hint: 'stops to read every wall', talkMul: 1.0 },
  { id: 'online', hint: 'never off their phone', talkMul: 1.0 },
  { id: 'wary', hint: 'trusts slowly, holds firmly', talkMul: 0.55 },
];
