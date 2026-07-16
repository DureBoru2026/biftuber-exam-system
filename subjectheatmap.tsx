import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { motion } from 'motion/react';
import { Flame, Info } from 'lucide-react';
import { ExamAttempt } from '../types';

interface SubjectHeatmapProps {
  attempts: ExamAttempt[];
}

export function SubjectHeatmap({ attempts }: SubjectHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Aggregate data by subject
  const subjectMap: Record<string, { totalScore: number; totalPoints: number; count: number }> = {};
  attempts
    .filter(a => a.status === 'completed' && a.score !== undefined && a.totalPoints !== undefined && a.examSubject)
    .forEach(attempt => {
      const sub = attempt.examSubject!;
      if (!subjectMap[sub]) {
        subjectMap[sub] = { totalScore: 0, totalPoints: 0, count: 0 };
      }
      subjectMap[sub].totalScore += attempt.score!;
      subjectMap[sub].totalPoints += attempt.totalPoints!;
      subjectMap[sub].count += 1;
    });

  const data = Object.entries(subjectMap).map(([subject, stats]) => ({
    subject,
    score: Math.round((stats.totalScore / stats.totalPoints) * 100),
    count: stats.count
  })).sort((a, b) => b.score - a.score);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 120 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = (data.length * 45) + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X axis scale
    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([0, width]);

    // Y axis scale
    const y = d3.scaleBand()
      .range([0, data.length * 45])
      .domain(data.map(d => d.subject))
      .padding(0.15);

    // Color scale for "Heat" (Performance Intensity)
    // Blue for low, Emerald for high
    const colorScale = d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateRgbBasis(["#F43F5E", "#F97316", "#FACC15", "#10B981"]));

    // Add bars with heatmap color
    svg.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", x(0))
      .attr("y", d => y(d.subject)!)
      .attr("width", 0) // Start at 0 for animation
      .attr("height", y.bandwidth())
      .attr("fill", d => colorScale(d.score))
      .attr("rx", 8)
      .transition()
      .duration(1000)
      .attr("width", d => x(d.score));

    // Add labels for subjects
    svg.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "900")
      .attr("font-size", "10px")
      .select(".domain").remove();

    // Custom formatting for intensity text on bars
    svg.selectAll(".score-text")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "score-text")
      .attr("x", d => x(d.score) - 10)
      .attr("y", d => y(d.subject)! + y.bandwidth() / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .attr("fill", "#fff")
      .attr("font-size", "10px")
      .attr("font-weight", "900")
      .text(d => `${d.score}%`)
      .attr("opacity", 0)
      .transition()
      .delay(800)
      .duration(500)
      .attr("opacity", 1);

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0,${data.length * 45})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}%`))
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "bold")
      .attr("font-size", "9px")
      .select(".domain").remove();

  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-150 flex items-center gap-1.5">
              <Flame size={10} fill="currentColor" />
              Sinfii Bilchinaa (Heatmap)
            </span>
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Xiyyeeffannoo Bilchina Barnootaa (D3 Heatmap)
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Ibsa dandeettii barnootaa halluun adda bahee mul'atu
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg 
          ref={svgRef} 
          className="w-full min-w-[500px]"
          style={{ height: 'auto' }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Laafaa (Critical)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Giddu-galeessa (Alert)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Gaarii (Good)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Baay'ee Gaarii (Mastery)</span>
        </div>
      </div>
      
      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
        <Info className="text-blue-600 shrink-0" size={18} />
        <p className="text-[10px] text-blue-800 font-bold leading-relaxed uppercase">
          Halluun diimaan bakka ati qabxii gad-bu'aa qabdu agarsiisa. Halluun magariisaa immoo bilchina kee barnoota sana irratti mul'isa. (Color intensity shifts from Red to Green based on your mastery).
        </p>
      </div>
    </div>
  );
}
