import { sitePages } from "../generated/content";
import { Layout } from "../site/ui";

function NotFoundBody() {
	return (
		<div>
			<h1>That page does not exist.</h1>
			<p>
				<a href="/">Go to home</a>
			</p>
		</div>
	);
}

export default function NotFoundPage() {
	return (
		<Layout sitePages={sitePages} currentPath="" toc={[]}>
			<NotFoundBody />
		</Layout>
	);
}
