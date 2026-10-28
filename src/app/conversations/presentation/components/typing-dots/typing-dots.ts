import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Three dots that rise in turn while the assistant writes; still under reduced motion. Decorative. */
@Component({
  selector: 'app-typing-dots',
  template: `<span></span><span></span><span></span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 1em;
    }

    span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.4;
      animation: typing 1200ms var(--tk-motion-standard) infinite;
    }

    span:nth-child(2) {
      animation-delay: 150ms;
    }

    span:nth-child(3) {
      animation-delay: 300ms;
    }

    @keyframes typing {
      0%,
      60%,
      100% {
        transform: translateY(0);
        opacity: 0.4;
      }

      30% {
        transform: translateY(-3px);
        opacity: 1;
      }
    }
  `,
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypingDots {}
