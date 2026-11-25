import { screen } from 'electron';
import type { WorkArea } from '../../shared/types';
export function workAreas(): WorkArea[] { return screen.getAllDisplays().map(d => ({ id: d.id, ...d.workArea })); }
export function primaryArea(): WorkArea { const display = screen.getPrimaryDisplay(); return { id: display.id, ...display.workArea }; }
