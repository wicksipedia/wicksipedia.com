import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";

export default async () => {
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
								// Title + description
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											flexDirection: "column",
										},
										children: [
											// Site title with orange dot
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														alignItems: "baseline",
														fontSize: 72,
														fontWeight: 700,
														color: "#e8e6e3",
														margin: 0,
													},
													children: [
														SITE.title,
														{
															type: "span",
															props: {
																style: {
																	color: "#ff7a1a",
																	marginLeft: "4px",
																},
																children: ".",
															},
														},
													],
												},
											},
											// Description
											{
												type: "p",
												props: {
													style: {
														fontSize: 24,
														color: "rgba(232,230,227,0.6)",
														lineHeight: 1.5,
														marginTop: "16px",
														maxHeight: "200px",
														overflow: "hidden",
													},
													children: SITE.desc,
												},
											},
										],
									},
								},
								// Bottom: URL
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											justifyContent: "flex-end",
											alignItems: "flex-end",
											width: "100%",
										},
										children: {
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
				`${SITE.title}${SITE.desc}wicksipedia.com`,
			),
		},
	);
};
