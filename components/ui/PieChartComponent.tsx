import React from 'react';
import { View, Text } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

const PieChartComponent = ({ data, width, height }:any) => {
  return (
    <View style={{ alignItems: 'center' }}>
      <PieChart
        data={data}
        width={width}
        height={height}
        chartConfig={{
          backgroundGradientFrom: '#fff',
          backgroundGradientTo: '#fff',
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        accessor="amount"
        backgroundColor="transparent"
        paddingLeft="15"
        center={[width / 4, 0]}
        absolute
      />
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 10 }}>
        Expense Breakdown
      </Text>
    </View>
  );
};

export default PieChartComponent;
