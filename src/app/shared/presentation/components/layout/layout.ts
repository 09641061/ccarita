import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** The signed-in shell. Each context adds its navigation entry here when its first screen is built. */
@Component({
  selector: 'app-layout',
  imports: [MatToolbarModule, RouterOutlet, TranslatePipe],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {}
