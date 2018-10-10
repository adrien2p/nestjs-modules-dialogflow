import { DialogFlowAuthorizationMiddleware } from '../middlewares/dialog-flow-authorization.middleware';
import { DialogFlowController } from './dialog-flow.controller';
import { DialogFlowService } from './dialog-flow.component';
import {
	DynamicModule,
	MiddlewareConsumer,
	Module,
	NestModule,
	OnModuleInit,
} from '@nestjs/common';
import { WebHookConfig } from '../interfaces/web-hook-config.interface';
import { ModulesContainer } from '@nestjs/core/injector';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import {ModuleRef} from '@nestjs/core';
import { DIALOG_FLOW_ACTION, DIALOG_FLOW_INTENT, nestMetadata } from '../constant';
import 'reflect-metadata';

@Module({
	providers: [DialogFlowService],
	controllers: [DialogFlowController],
})
export class DialogFlowModule implements NestModule, OnModuleInit {
	public static forRoot(webHookConfig?: WebHookConfig): DynamicModule {
		webHookConfig = {
			basePath: 'web-hooks',
			postPath: 'dialog-flow',
			...webHookConfig,
		};

		return {
			module: DialogFlowModule,
			providers: [DialogFlowService],
			controllers: [DialogFlowController.forRoot(webHookConfig)],
		};
	}

	constructor(
		private readonly modulesContainer: ModulesContainer,
		private readonly moduleRef: ModuleRef, 
		private readonly dialogFlowService: DialogFlowService,
	) {}

	public onModuleInit(): any {
		const metadataScanner = new MetadataScanner();
		const modules = [...this.modulesContainer.values()];

		modules.forEach(({ metatype }) => {
			const metadata = Reflect.getMetadata(nestMetadata.COMPONENTS, metatype) || [];
			const components = [...metadata.filter(metatype => typeof metatype === 'function')];

			components.map(component => {
				const reflectedMetadata = metadataScanner
					.scanFromPrototype(null, component.prototype, method => {
						const intentOrAction =
							Reflect.getMetadata(
								DIALOG_FLOW_INTENT,
								Reflect.getOwnPropertyDescriptor(component.prototype, method).value,
							) ||
							Reflect.getMetadata(
								DIALOG_FLOW_ACTION,
								Reflect.getOwnPropertyDescriptor(component.prototype, method).value,
							);
						return intentOrAction ? { provider: component, intentOrAction, method } : null;
					})
					.filter(v => v);

				[...reflectedMetadata].forEach(metadata => {
					this.dialogFlowService.addHandler(
						metadata.intentOrAction,
						this.moduleRef.get(metadata.provider, {strict: false}),
						metadata.method,
					);
				});
			});
		});
	}

	public configure(consumer: MiddlewareConsumer) {
		return consumer.apply([DialogFlowAuthorizationMiddleware]).forRoutes(DialogFlowController);
	}
}
