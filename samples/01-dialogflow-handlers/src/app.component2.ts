import { Injectable } from '@nestjs/common';

@Injectable()
export class AppComponent2 {
    public haveBeenCalled(intentOrAction: string): void {
        console.log(`intent or action ${intentOrAction} have been called`);
    }
}
