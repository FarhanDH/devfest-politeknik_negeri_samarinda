import React from "react";

export type HeaderProviderState = {
	headerConfig?: {
		headerTitle?: string;
		headerDescription?: string;
		isVisible?: boolean;
	};
	setHeaderConfig?: (config: HeaderProviderState["headerConfig"]) => void;
};

const HeaderProviderContext = React.createContext<HeaderProviderState>({});

export const HeaderProvider: React.FC<React.PropsWithChildren> = ({
	children,
}) => {
	const [headerConfig, setHeaderConfig] = React.useState<
		HeaderProviderState["headerConfig"]
	>({
		headerTitle: "Dashboard",
		headerDescription: "Manage your Apps and view your usage.",
	});
	return (
		<HeaderProviderContext.Provider
			value={{
				headerConfig,
				setHeaderConfig,
			}}
		>
			{children}
		</HeaderProviderContext.Provider>
	);
};

export const useHeader = () => {
	const context = React.use(HeaderProviderContext);
	if (!context) {
		throw new Error("useHeader must be used within a HeaderProvider");
	}
	return context;
};

type HeaderConfigurationProps = {
	headerTitle?: string;
	headerDescription?: string;
	isVisible?: boolean;
};
export const HeaderConfiguration: React.FC<HeaderConfigurationProps> = ({
	isVisible,
	...props
}) => {
	const { headerConfig, setHeaderConfig } = useHeader();

	React.useEffect(() => {
		if (setHeaderConfig) {
			setHeaderConfig({
				headerTitle: props.headerTitle || headerConfig?.headerTitle,
				headerDescription:
					props.headerDescription || headerConfig?.headerDescription,
				isVisible: isVisible ?? true,
			});
		}
	}, [props.headerTitle, props.headerDescription, isVisible, setHeaderConfig]);
	// Return null to avoid rendering anything

	return null;
};
