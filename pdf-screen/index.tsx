import React from "react";
import {
  Page,
  Document,
  StyleSheet,
  Text,
  Image,
  View,
} from "@react-pdf/renderer";

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "white",
    margin: "4px",
  },
  statusLogo: {
    height: "12px",
    paddingTop: '10px'
  },
  testCaseName: {
    margin: "20px 15px",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: "12px",
    fontWeight: "medium",
  },
  testTile: {
    margin: " 0px 15px",
    display: "flex",
    flexDirection: "row",
    justifyContent: 'space-between',
  },
  testViewTile: {
    display: "flex",
    flexDirection: "column",
    fontSize: "10px",
  },
  testImage: {
    marginTop: "20px",
    width: "380px",
    height: "200px",
  },
  logoImage: {
    marginLeft: "8px",
    marginTop: "10px",
    width: "100px",
    height: "25px",
  },
});

// Create Document Component
export const MyDocument = (
  testCase: string,
  status: string,
  beforeStep: string,
  beforeImg: string,
  afterStep?: string,
  afterImg?: string
) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Image
        src={"Resources/images/pdfLogo.png"}
        style={styles.logoImage}
      ></Image>
      <View style={styles.testCaseName}>
        <Text>
          Test case name: <Text style={{ fontWeight: "bold" }}>{testCase}</Text>
        </Text>
        <Text>
          Status:{" "}
          <Text style={{ fontWeight: "bold" }}>
            <Image
              style={styles.statusLogo}
              src={
                status == "Passed"
                  ? "Resources/images/greentick.png"
                  : "Resources/images/invaidated.jpeg"
              }
            ></Image>{" "}
            {status}
          </Text>
        </Text>
      </View>
      <div style={styles.testTile}>
        <div style={styles.testViewTile}>
          <Text>{beforeStep}</Text>
          <Image
            src={`data:image/png;base64,${beforeImg}`}
            style={styles.testImage}
          ></Image>
        </div>
        {afterStep && (
          <View style={styles.testViewTile}>
            <Text>{afterStep}</Text>
            <Image
              style={styles.testImage}
              src={`data:image/png;base64,${afterImg}`}
            ></Image>
          </View>
        )}
      </div>
    </Page>
  </Document>
);
