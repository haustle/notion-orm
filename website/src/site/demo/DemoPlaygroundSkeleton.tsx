import { IconArrow } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconArrow";
import { IconPageText } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconPageText";
import Link from "next/link";
import { cx } from "../../styled-system/css";
import { DEMO_PLAYGROUND_RESET_BUTTON_CLASS } from "../siteClassNames";
import {
	demoPlaygroundPanelOrder,
	demoPlaygroundPanels,
	playgroundApiReferenceLinkClass,
	playgroundEditorContainerClass,
	playgroundEditorContainerPlaceholderClass,
	playgroundExampleSchemaModeLabelClass,
	playgroundExampleSchemaSwitchRowClass,
	playgroundFileLabelClass,
	playgroundHeaderActionsClass,
	playgroundHeaderBulletClass,
	playgroundHeaderClass,
	playgroundHeaderTitleGroupClass,
	playgroundLoadingOverlayClass,
	playgroundNotionSchemaToggleButtonClass,
	playgroundResetButtonClass,
	playgroundSectionGapClass,
	playgroundWrapperClass,
} from "./demoPlaygroundChrome";
import { DEMO_DATABASES_EXAMPLE_FILE_LABEL } from "./demoPlaygroundNotionSchemaFiles";

export function DemoPlaygroundSkeleton() {
	return (
		<>
			{demoPlaygroundPanelOrder.map((panelId) => {
				const panel = demoPlaygroundPanels[panelId];
				return (
					<div
						key={panelId}
						className={cx(
							playgroundWrapperClass,
							panel.sectionGap && playgroundSectionGapClass,
						)}>
						<div className={playgroundHeaderClass}>
							<div className={playgroundHeaderTitleGroupClass}>
								<span className={playgroundFileLabelClass}>{panel.label}</span>
								<span className={playgroundHeaderBulletClass} aria-hidden>
									·
								</span>
								<Link
									href={panel.apiReferenceHref}
									className={playgroundApiReferenceLinkClass}
									aria-label={panel.apiReferenceAriaLabel}>
									Docs
								</Link>
							</div>
							<div className={playgroundHeaderActionsClass}>
								{panelId === "databases" && (
									<button
										type="button"
										className={cx(
											playgroundExampleSchemaSwitchRowClass,
											playgroundNotionSchemaToggleButtonClass,
										)}
										disabled
										tabIndex={-1}
										aria-hidden>
										<IconPageText aria-hidden />
										<span className={playgroundExampleSchemaModeLabelClass}>
											{DEMO_DATABASES_EXAMPLE_FILE_LABEL}
										</span>
									</button>
								)}
								<button
									type="button"
									className={cx(
										playgroundResetButtonClass,
										DEMO_PLAYGROUND_RESET_BUTTON_CLASS,
									)}
									disabled
									aria-label={panel.resetAriaLabel}>
									<IconArrow aria-hidden />
								</button>
							</div>
						</div>
						<div
							className={cx(
								playgroundEditorContainerClass,
								playgroundEditorContainerPlaceholderClass,
							)}>
							<div className={playgroundLoadingOverlayClass}>
								Loading playground…
							</div>
						</div>
					</div>
				);
			})}
		</>
	);
}
