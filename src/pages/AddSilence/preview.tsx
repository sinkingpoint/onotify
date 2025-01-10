import { Matcher } from "../../pkg/types/api";

export interface PreviewProps {
	duration: string;
	matchers: Matcher[];
	comment: string;
}

export const PreviewSilence = ({ duration, matchers, comment }: PreviewProps) => {
	return <></>;
};
