import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";

export default async (post) => {
	const title = post.data.title;
	const tags = post.data.tags || [];
	const fontSize = title.length > 60 ? 48 : title.length > 40 ? 56 : 64;

	const tagPills = tags.map((tag) => ({
		type: "span",
		props: {
			style: {
				fontSize: 16,
				fontWeight: 400,
				color: "#ff7a1a",
				border: "2px solid rgba(255,122,26,0.4)",
				borderRadius: "6px",
				padding: "4px 12px",
				marginRight: "8px",
			},
			children: tag,
		},
	}));

	return satori(
		{
			type: "div",
			props: {
				style: {
					width: "100%",
					height: "100%",
					background: "#0f1117",
					display: "flex",
					flexDirection: "row",
					alignItems: "stretch",
				},
				children: [
					// Orange left accent bar
					{
						type: "div",
						props: {
							style: {
								width: "8px",
								background: "#ff7a1a",
								marginTop: "60px",
								marginBottom: "60px",
								marginLeft: "60px",
								borderRadius: "4px",
							},
						},
					},
					// Content area
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								flexDirection: "column",
								justifyContent: "space-between",
								padding: "60px 60px 50px 40px",
								flex: 1,
							},
							children: [
								// Title
								{
									type: "h1",
									props: {
										style: {
											fontSize,
											fontWeight: 700,
											color: "#e8e6e3",
											lineHeight: 1.15,
											margin: 0,
											maxHeight: "400px",
											overflow: "hidden",
										},
										children: title,
									},
								},
								// Bottom row: tags + site branding
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											justifyContent: "space-between",
											alignItems: "flex-end",
											width: "100%",
										},
										children: [
											// Tags
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														flexWrap: "wrap",
													},
													children: tagPills,
												},
											},
											// Site branding
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														alignItems: "center",
														fontSize: 20,
														fontWeight: 700,
														color: "#e8e6e3",
													},
													children: [
														"wicksipedia",
														{
															type: "span",
															props: {
																style: {
																	color: "#ff7a1a",
																	marginLeft: "2px",
																	fontSize: 24,
																},
																children: ".",
															},
														},
														{
															type: "span",
															props: {
																style: { color: "#e8e6e3" },
																children: "com",
															},
														},
													],
												},
											},
										],
									},
								},
							],
						},
					},
				],
			},
		},
		{
			width: 1200,
			height: 630,
			embedFont: true,
			fonts: await loadGoogleFonts(
				`${title}${tags.join("")}wicksipedia.com`,
			),
		},
	);
};
